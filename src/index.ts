import {
  addUser,
  validateLogin,
  addUpload,
  countUploads,
  //getDisplayName,
  //getUsername,
  //findDeletionToken,
  //deleteUpload,
  //setDisplayName,
  setPassword,
  //getVerifiedStatus,
  //getProfilePicture,
  generateInviteCode,
  invitedUserRegister,
  getUserDataByUpload,
  deleteUploadWithToken,
  getUploadData,
} from "./mongo";
import * as bunny from './bunny';
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
import queryString from 'querystring';

const port = process.env.PORT || 3000;
const signUrls: boolean = false;

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
  //const uploadPath = __dirname + "/../uploads/" + fileName;
  const deleteToken = (Math.random() + 1).toString(36).substring(2, 52);

  const filePath = await bunny.uploadFileStream(file);
  const fileLink = bunny.settings.cdn_url + filePath;
  addUpload(req.body.username, fileName, fileLink, deleteToken);

  res.setHeader("Content-Type", "application/json").send(
    JSON.stringify({
      file_name: fileName,
      uploader: req.body.username,
      delete_token: deleteToken,
      host: req.headers.host,
      protocol: req.protocol,
      path: "/" + fileName,
      raw_file_path: fileLink,
    }),
  );

  /*
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
  */
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

app.get("/thanks", async (_, res) => {
  res.sendFile(path.join(__dirname, "/public/thanks.html"));
});

app.post("/api/users/register", async (req, res) => {
  const { inviteCode, username, domain, embedTitle, embedColor } = req.body;
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
    embedColor || "#050505",
    embedTitle || displayName || username,
    displayName || username,
  );
  if (!success)
    return res.status(500).json({
      success: false,
      error: "Unknown error, please try again.",
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
      if (!json.avatar) {
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
    })
    .catch((error) => {
      res.status(400).json({
        success: false,
        error: "The Discord user doesn't exist!",
      });
      console.log("Error:", error);
      return;
    });
});

/*
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
*/

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

app.get("/uploads/:img", async (req, res) => {
  res.redirect("../" + req.params.img);
});

app.get("/:img", async (req, res) => {
  if (!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
    return;
  } else {
    const userData = await getUserDataByUpload(req.params.img);
    const uploadData = await getUploadData(req.params.img);
    if (!userData) return res.end();
    //const author = await getDisplayName(req.params.img);
    //console.log(req.headers["user-agent"]);
    const botUserAgents = [
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "TelegramBot (like TwitterBot)",
      "Twitterbot/1.0",
      "@LinkArchiver twitter bot",
      "Twitterbot/0.1",
      "Valve/Steam HTTP Client 1.0 (SteamChatURLLookup)",
    ];
    if (
      req.headers["user-agent"] &&
      botUserAgents.includes(req.headers["user-agent"])
    ) {
      return res.setHeader("Cache-Control", "max-age=3600, must-revalidate").send(`
            <!doctype html>
            <html>
                <head>
                    <meta property="og:author" content="${userData["embed"]["title"]}">
                    <meta property="og:title" content="‎‎‎‎‎‎‎‎">
                    <meta name="theme-color" content="${userData["embed"]["color"]}">
                    <meta property="og:image" content="${uploadData['url']}">
                    <link type="application/json+oembed" href="https://${req.headers.host}/api/oembed?author=${userData["embed"]["title"]}&file=${req.params.img}" />
                    <meta name="twitter:card" content="summary_large_image">
                    <meta name="twitter:image" content="${uploadData['url']}">
                    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-refresh">
                    <meta http-equiv="Pragma" content="no-cache">
                    <meta http-equiv="Expires" content="0">
                    <meta http-equiv="refresh" content="0; url=${uploadData['url']}">
                </head>
            </html>
            `);
    }

    //const imagePath = path.join(__dirname, "/../uploads/", req.params.img);
    //if (!fs.existsSync(imagePath)) return res.status(404).end();


    await res.setHeader("Content-Security-Policy", 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; " +
      "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; " +
      `img-src 'self' ${bunny.settings.cdn_url} data:; ` +
      "font-src 'self' https://fonts.gstatic.com https://unpkg.com;"
    ).render("imageViewer", {
      coverImg: uploadData['url'],
      author: userData["displayName"] || userData["username"],
      authorImg: userData["profilePicture"]
        ? `${signUrls?signUrl(bunny.settings.cdn_url+"avatars/"+userData["profilePicture"], process.env.BUNNY_TAUTH_KEY||""):bunny.settings.cdn_url+"avatars/"+userData["profilePicture"]}`
        : `https://${req.headers.host}/assets/img/placeholder.png`,
      fileName: req.params.img,
      verified: (await userData["verified"]) ? `block` : `none`,
    });
    
  }
});

function signUrl(url: string, securityKey: string, expirationTime: number = 3600, userIp: string = "", isDirectory: boolean = false) {
	let parameterData = "", parameterDataUrl = "", signaturePath = "", hashableBase = "", token = "";
	const expires = Math.round(Date.now() / 1000) + expirationTime;
	const parsedUrl = new URL(url);
	const parameters = (new URL(url)).searchParams;
	signaturePath = decodeURIComponent(parsedUrl.pathname);
	parameters.sort();
	if (Array.from(parameters).length > 0) {
		parameters.forEach(function(value, key) {
			if (value == "") {
				return;
			}
			if (parameterData.length > 0) {
				parameterData += "&";
			}
			parameterData += key + "=" + value;
			parameterDataUrl += "&" + key + "=" + queryString.escape(value);
			
		});
	}
	hashableBase = securityKey + signaturePath + expires + ((userIp != "") ? userIp : "") + parameterData;
	token = Buffer.from(crypto.createHash("sha256").update(hashableBase).digest()).toString("base64");
	token = token.replace(/\n/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
	if (isDirectory) {
		return parsedUrl.protocol+ "//" + parsedUrl.host + "/bcdn_token=" + token + parameterDataUrl + "&expires=" + expires + parsedUrl.pathname;
	} else {
		return parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname + "?token=" + token + parameterDataUrl + "&expires=" + expires;
	}
}

// Legacy
/*app.get("/uploads/og/:img", (req, res) => {
  res.redirect("../raw/" + req.params.img);
});*/
/*
app.get("/uploads/raw/:img", async (req, res) => {
  if (!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
    return res.status(403).end();
  } else {
    const imagePath = path.join(__dirname, "/../uploads/", req.params.img);
    
    if(fs.existsSync(imagePath)){
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
    } else {
      res.status(404).end();
    }
  }
});
*/
app.get("/api/delete", async (req, res) => {
  if (!req.query.token) return res.status(401).end();

  const token = req.query.token as string;
  /*
  const file = await findDeletionToken(token);

  if (!file) return res.status(403).end();

  const deleted = await deleteUpload(file);
  */

  const deleted = await deleteUploadWithToken(token);

  if (deleted) {
    res.status(200).end("File deleted successfully!");
  } else {
    res
      .status(500)
      .end(
        "There was an error deleting the uploaded file. Did you provide the correct token?",
      );
  }
});

app.listen(port, () => {
  console.log("Listening");
});

const generatePassword = (length = 32) => {
  const lowerCase = "abcdefghijklmnopqrstuvwxyz";
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let password = [
    lowerCase[Math.floor(Math.random() * lowerCase.length)],
    upperCase[Math.floor(Math.random() * upperCase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
  ];
  const allChars = lowerCase + upperCase + numbers;
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, allChars.length);
    password.push(allChars[randomIndex]);
  }
  return password.join("");
};
