import { addUser, validateLogin, addUpload, countUploads, getFileAuthor, findDeletionToken, deleteUpload } from "./mongo";
import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import fileUpload from 'express-fileupload'
import bodyParser from "body-parser";
import 'dotenv/config';
import * as fs from 'fs';
import mime from 'mime';

const port = process.env.PORT || 3000;

const app = express();

import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
	windowMs: 2 * 60 * 1000, // 2 min /
	limit: 100,              // max 100 requests
	standardHeaders: 'draft-7',
	legacyHeaders: false,
})

app.use(limiter)
app.use(cors());
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
}));

app.use('/', express.static('src/public'))

app.post("/api/users/login", async (req, res) => {
    const {username, password} = req.body;
    const validLogin: boolean = await validateLogin(username, password);

    if(validLogin) {
        res.status(200).end();
    } else {
        res.status(401).end();
    }
})

app.get("/api/counter", async (req, res) => {
    const counter = await countUploads();

    res.status(200).json({
        count: counter
    });
})

app.get("/api/oembed", async (req, res) => {
    if(!req.query.file || !req.query.author) {
        return res.status(400).end();
    }
    
    return res.json({
        type: "rich",
        version: "1.0",
        provider_name: req.query.author,
        provider_url: "https://" + req.headers.host,
        author: req.query.author,
        url: "https://" + req.headers.host + "/uploads/" + req.query.file,
        thumbnail_url: "https://" + req.headers.host + "/uploads/og/" + req.query.file
    })
})

app.post("/api/users/upload", async (req, res) => {
    if(!req.body.username || !req.body.password) return res.status(401).end();
    const isValid = await validateLogin(req.body.username, req.body.password);

    if(!isValid) {
        return res.status(401).end();
    }

    if(!req.files || !req.files.file) {
        return res.status(400).end();
    }

    const file = req.files.file;

    if (Array.isArray(file)) {
        return res.status(400).send("Only one file at a time is allowed.");
    }

    const fileName = (Math.random() + 1).toString(36).substring(2, 12) + "." + /(?:\.([^.]+))?$/.exec(file.name)![1];
    const uploadPath = __dirname + '/../uploads/' + fileName;
    const deleteToken = (Math.random() + 1).toString(36).substring(2, 52);

    file.mv(uploadPath, function(err) {
        if (err) {
            return res.status(500).send(err);
        }
        
        addUpload(req.body.username, fileName, deleteToken);
        res.setHeader("Content-type", "application/json").send(
            JSON.stringify({
                "file_name": fileName,
                "uploader": req.body.username,
                "delete_token": deleteToken,
                "host": req.headers.host,
                "protocol": req.protocol,
                "path": "/" + fileName
            })
        )
    });
});

app.post("/api/users/create", async (req, res) => {
    const {username, password} = req.body;
    const authorization = req.headers.authorization;
    if(authorization!== "Bearer "+process.env.SUPERADMIN_UUID) return res.status(401).end("Unauthorized");
    const created: boolean = await addUser(username, password) || false;
    await res.status(created === true? 200 : 500).end(created.toString());
})

app.get("/uploads", async(_,res)=>{res.redirect("https://www.youtube.com/watch?v=WsBv8--PX3o")})
app.get("/uploads/og", async(_,res)=>{res.redirect("https://www.youtube.com/watch?v=WsBv8--PX3o")})

// Legacy stuff
app.get("/uploads/:img",async(req,res)=>{
    res.redirect('../'+req.params.img)
})

app.get("/:img", async (req, res) => {
    if(!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
        return;
    } else {
        const author = await getFileAuthor(req.params.img);
        //console.log(req.headers["user-agent"]);
        if(req.headers["user-agent"] && req.headers["user-agent"] === "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)") {
            return res.send(`
            <!doctype html>
            <html>
                <head>
                    <meta property="og:author" content="${author}">
                    <meta property="og:title" content="‎‎‎‎‎‎‎‎">
                    <meta name="theme-color" content="#050505">
                    <meta property="og:image" content="https://${req.headers.host}/uploads/og/${req.params.img}">
                    <link type="application/json+oembed" href="https://${req.headers.host}/api/oembed?author=${author}&file=${req.params.img}" />
                    <meta name="twitter:card" content="summary_large_image">

                    <meta property="og:video" content="https://${req.headers.host}/uploads/${req.params.img}">
                    <meta property="og:video:type" content="video/mp4" />
                </head>
            </html>
            `)
        }

        res.setHeader("Content-Type", mime.lookup(/(?:\.([^.]+))?$/.exec(req.params.img)![1]))
        const imagePath = path.join(__dirname, '/../uploads/', req.params.img);
        const imageStream = fs.createReadStream(imagePath);

        imageStream.on('error', (err) => {
            //console.error('Error reading file:', err);
            res.status(404).end();
        });

        imageStream.pipe(res);
    }
})

app.get("/uploads/og/:img", async (req, res) => {
    if(!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
        return res.status(403).end();
    } else {
        res.setHeader("Content-Type", mime.lookup(/(?:\.([^.]+))?$/.exec(req.params.img)![1]))
        const imagePath = path.join(__dirname, '/../uploads/', req.params.img);
        const imageStream = fs.createReadStream(imagePath);

        imageStream.on('error', (err) => {
            //console.error('Error reading file:', err);
            res.status(404).end();
        });

        imageStream.pipe(res);
    }
})

app.get("/api/delete", async (req, res) => {
    if(!req.query.token) return res.status(401).end();

    const token = req.query.token as string;
    const file = await findDeletionToken(token);

    if(!file) return res.status(403).end();

    const deleted = await deleteUpload(file);

    if(deleted) {
        res.status(200).end("ok");
    } else {
        res.status(500).end();
    }
})

app.listen(port, ()=>{console.log("Listening")})