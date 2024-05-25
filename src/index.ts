import {
  addUser,
  validateLogin,
  addUpload,
  countUploads,
  getDisplayName,
  getUsername,
  findDeletionToken,
  deleteUpload,
  setDisplayName,
  setPassword,
  getVerifiedStatus,
  getProfilePicture,
  generateInviteCode,
  invitedUserRegister,
} from "./mongo";
import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import fileUpload from "express-fileupload";
import bodyParser from "body-parser";
import "dotenv/config";
import * as fs from "fs";
import mime from "mime";
import axios from "axios";
import fastFolderSize from "fast-folder-size";
import crypto from "crypto";

const port = process.env.PORT || 3000;

const app = express();

import { rateLimit } from "express-rate-limit";

app.set("trust proxy", "loopback");

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 min /
  limit: 100, // max 100 requests
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use(limiter);

app.use(cors());
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  }),
);

app.use("/", express.static("src/public"));

app.set("view engine", "hbs");

app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  const validLogin: boolean = await validateLogin(username, password);

  if (validLogin) {
    res.status(200).end();
  } else {
    res.status(401).end();
  }
});

app.get("/api/counter", async (req, res) => {
  const counter = await countUploads();
  fastFolderSize("./uploads", (err, size) => {
    if (err) console.error(err);
    res.status(200).json({
      count: counter,
      size: size,
    });
  });
});

app.get("/api/oembed", async (req, res) => {
  if (!req.query.file || !req.query.author) {
    return res.status(400).end();
  }

  return res.json({
    type: "rich",
    version: "1.0",
    provider_name: req.query.author,
    provider_url: "https://" + req.headers.host,
    author: req.query.author,
    url: "https://" + req.headers.host + "/uploads/" + req.query.file,
    thumbnail_url:
      "https://" + req.headers.host + "/uploads/og/" + req.query.file,
  });
});

app.post("/api/users/upload", async (req, res) => {
  if (!req.body.username || !req.body.password) return res.status(401).end();
  const isValid = await validateLogin(req.body.username, req.body.password);

  if (!isValid) {
    return res.status(401).end();
  }

  if (!req.files || !req.files.file) {
    return res.status(400).end();
  }

  const file = req.files.file;

  if (Array.isArray(file)) {
    return res.status(400).send("Only one file at a time is allowed.");
  }

  const fileName =
    (Math.random() + 1).toString(36).substring(2, 12) +
    "." +
    /(?:\.([^.]+))?$/.exec(file.name)![1];
  const uploadPath = __dirname + "/../uploads/" + fileName;
  const deleteToken = (Math.random() + 1).toString(36).substring(2, 52);

  file.mv(uploadPath, function (err) {
    if (err) {
      return res.status(500).send(err);
    }

    addUpload(req.body.username, fileName, deleteToken);
    res.setHeader("Content-type", "application/json").send(
      JSON.stringify({
        file_name: fileName,
        uploader: req.body.username,
        delete_token: deleteToken,
        host: req.headers.host,
        protocol: req.protocol,
        path: "/" + fileName,
        raw_file_path: "/uploads/raw/" + fileName,
      }),
    );
  });
});

app.post("/api/users/create", async (req, res) => {
  const { username, password } = req.body;
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  const created: boolean = (await addUser(username, password)) || false;
  await res.status(created === true ? 200 : 500).end(created.toString());
});

app.post("/api/users/genInvite", async (req, res) => {
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  const inviteCode: string = await generateInviteCode();
  if (!inviteCode)
    return res.json({
      success: false,
    });
  res.json({
    success: true,
    code: inviteCode,
  });
});

app.get("/register", async (_, res) => {
  res.sendFile(path.join(__dirname, "/public/register.html"));
});

app.get("/terms", async (_, res) => {
  res.sendFile(path.join(__dirname, "/public/terms.html"));
});

app.get("/tos", async (_, res) => {
  res.redirect("/terms");
});

app.get("/terms-of-service", async (_, res) => {
  res.redirect("/terms");
});

app.post("/api/users/register", async (req, res) => {
  const { inviteCode, username, domain } = req.body;
  let { displayName } = req.body; // ha később kellene módosítani
  if (!inviteCode || !username) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
    });
  }
  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      error: "The provided username is too short!",
    });
  }
  if (!displayName) displayName = username;
  const password = generatePassword();
  const success: boolean = await invitedUserRegister(
    inviteCode,
    username,
    password,
    displayName || username,
    false,
  );
  if (!success)
    return res.status(500).json({
      success: false,
      error: "Unknown error",
    });

  const fileData = Buffer.from(
    JSON.stringify({
      Version: "16.0.1",
      Name: `liba sharex - ${username}`,
      DestinationType: "ImageUploader, FileUploader",
      RequestMethod: "POST",
      RequestURL: `https://${domain}/api/users/upload`,
      Body: "MultipartFormData",
      Arguments: {
        username: `${username}`,
        password: `${password}`,
      },
      FileFormName: "file",
      URL: "https://{json:host}{json:path}",
      ThumbnailURL: "https://{json:host}/uploads/og/{json:file_name}",
      DeletionURL: "https://{json:host}/api/delete?token={json:delete_token}",
    }),
  ).toString("base64");

  //most így utólag belegondolva ennek az oda-vissza konverziónak nem túl sok értelme van, de őszintén már nem érdekel annyira hogy legyen türelmem másképp megoldani

  res.writeHead(200, {
    "Content-Disposition": `attachment; filename="${username}.sxcu"`,
    "Content-Type": "text/plain",
  });

  const download = Buffer.from(fileData, "base64");
  res.end(download);
});

app.get("/api/discord-profile-picture", async (req, res) => {
  const { id } = req.query;
  if (!id)
    return res.status(400).json({
      success: false,
      error: "Bad Request",
    });

  await axios
    .get("https://discord.com/api/v9/users/" + id, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN || ""}` },
    })
    .then(async (response) => {
      let json = response.data;
      //console.log(json)
      if(!json.avatar) {
        res.status(400).json({
          success: false,
          error: "The Discord user doesn't have a profile picture set!",
        });
        return;
      }
      const image = await axios.get(
        `https://cdn.discordapp.com/avatars/${id}/${json.avatar}.png?size=1024`,
        {
          responseType: "stream",
        },
      );
      res.setHeader("Content-Type", "image/png");
      image.data.pipe(res);
    }).catch(error=>{
      res.status(400).json({
        success: false,
        error: "The Discord user doesn't exist!",
      });
      console.log("Error:", error);
      return;
    });
});

app.post("/api/users/changeDisplayName", async (req, res) => {
  const { username, displayName } = req.body;
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  if (displayName.length > 257)
    return res.status(400).end("Display name is too long!");
  const changed: boolean = await setDisplayName(username, displayName);
  await res.status(changed === true ? 200 : 500).end(changed.toString());
});

app.post("/api/users/changePassword", async (req, res) => {
  const { username, newPassword } = req.body;
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  const changed: boolean = await setPassword(username, newPassword);
  await res.status(changed === true ? 200 : 500).end(changed.toString());
});

app.get("/uploads", async (_, res) => {
  res.redirect("https://www.youtube.com/watch?v=WsBv8--PX3o");
});
app.get("/uploads/og", async (_, res) => {
  res.redirect("https://www.youtube.com/watch?v=WsBv8--PX3o");
});

// Legacy stuff
app.get("/uploads/:img", async (req, res) => {
  res.redirect("../" + req.params.img);
});

app.get("/:img", async (req, res) => {
  if (!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
    return;
  } else {
    const author = await getDisplayName(req.params.img);
    //console.log(req.headers["user-agent"]);
    const botUserAgents = [
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "TelegramBot (like TwitterBot)",
      "Twitterbot/1.0",
    ];
    if (
      req.headers["user-agent"] &&
      botUserAgents.includes(req.headers["user-agent"])
    ) {
      return res.send(`
            <!doctype html>
            <html>
                <head>
                    <meta property="og:author" content="${author}">
                    <meta property="og:title" content="‎‎‎‎‎‎‎‎">
                    <meta name="theme-color" content="#050505">
                    <meta property="og:image" content="https://${req.headers.host}/uploads/raw/${req.params.img}">
                    <link type="application/json+oembed" href="https://${req.headers.host}/api/oembed?author=${author}&file=${req.params.img}" />
                    <meta name="twitter:card" content="summary_large_image">
                </head>
            </html>
            `);
    }

    /*
        res.setHeader("Content-Type", mime.lookup(/(?:\.([^.]+))?$/.exec(req.params.img)![1]))
        const imagePath = path.join(__dirname, '/../uploads/', req.params.img);
        const imageStream = fs.createReadStream(imagePath);

        imageStream.on('error', (err) => {
            //console.error('Error reading file:', err);
            res.status(404).end();
        });

        imageStream.pipe(res);
    */
    const imagePath = path.join(__dirname, "/../uploads/", req.params.img);
    if (!fs.existsSync(imagePath)) return res.status(404).end();
    const username = await getUsername(req.params.img);
    const profilePic = await getProfilePicture(username);
    await res.render("imageViewer", {
      coverImg:
        "https://" + req.headers.host + "/uploads/raw/" + req.params.img,
      author: username,
      authorImg: profilePic
        ? `https://${req.headers.host}/${profilePic}`
        : `https://${req.headers.host}/assets/img/placeholder.png`,
      date: new Date(fs.statSync(imagePath).birthtime).toLocaleDateString(),
      fileName: req.params.img,
      verified: (await getVerifiedStatus(username)) ? `block` : `none`,
    });
  }
});

// Legacy
app.get("/uploads/og/:img", (req, res) => {
  res.redirect("../raw/" + req.params.img);
});

app.get("/uploads/raw/:img", async (req, res) => {
  if (!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
    return res.status(403).end();
  } else {
    const imagePath = path.join(__dirname, "/../uploads/", req.params.img);
    const imageStream = fs.createReadStream(imagePath);

    res.set({
      "Content-Type": mime.lookup(/(?:\.([^.]+))?$/.exec(req.params.img)![1]),
      "Content-Length": fs.statSync(imagePath).size.toString(),
    });

    imageStream.on("error", (err) => {
      //console.error('Error reading file:', err);
      res.status(404).end();
    });

    imageStream.pipe(res);
  }
});

app.get("/api/delete", async (req, res) => {
  if (!req.query.token) return res.status(401).end();

  const token = req.query.token as string;
  const file = await findDeletionToken(token);

  if (!file) return res.status(403).end();

  const deleted = await deleteUpload(file);

  if (deleted) {
    res.status(200).end("ok");
  } else {
    res.status(500).end();
  }
});

app.listen(port, () => {
  console.log("Listening");
});

const generatePassword = (length = 32) => {
  const lowerCase = "abcdefghijklmnopqrstuvwxyz";
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const specialChars = "!@#$%^&*()_+[]{}|;:,.<>?";
  let password = [
    lowerCase[Math.floor(Math.random() * lowerCase.length)],
    upperCase[Math.floor(Math.random() * upperCase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    specialChars[Math.floor(Math.random() * specialChars.length)],
  ];
  const allChars = lowerCase + upperCase + numbers + specialChars;
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, allChars.length);
    password.push(allChars[randomIndex]);
  }
  return password.join("");
};
