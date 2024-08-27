import { Router } from "express";
import * as mongo from "../utils/mongo";
import { generatePassword } from "../utils/helpers";
import fastFolderSize from "fast-folder-size";

const router = Router();

router.get("/counter", async (req, res) => {
  const counter = await mongo.countUploads();
  fastFolderSize("./uploads", (err, size) => {
    if (err) console.error(err);
    res.status(200).json({
      count: counter,
      size: size,
    });
  });
});

router.get("/oembed", async (req, res) => {
    if (!req.query.file || !req.query.author) {
      return res.status(400).end();
    }
  
    return res.json({
      type: "rich",
      version: "1.0",
      provider_name: req.query.author,
      provider_url: "https://" + req.headers.host,
      author: req.query.author,
      title: "",
      url: "https://" + req.headers.host + "/uploads/" + req.query.file,
      thumbnail_url:
        "https://" + req.headers.host + "/uploads/og/" + req.query.file,
    });
});

router.post("/users/login", async (req, res) => {
  const { username, password } = req.body;
  const validLogin: boolean = await mongo.validateLogin(username, password);

  if (validLogin) {
    res.status(200).end();
  } else {
    res.status(401).end();
  }
});

router.post("/users/create", async (req, res) => {
  const { username, password } = req.body;
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  const created: boolean = (await mongo.addUser(username, password)) || false;
  res.status(created === true ? 200 : 500).end(created.toString());
});

router.post("/users/genInvite", async (req, res) => {
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  const inviteCode: string = await mongo.generateInviteCode();
  if (!inviteCode) return res.json({ success: false });
  res.json({ success: true, code: inviteCode });
});

router.post("/users/register", async (req, res) => {
  const { inviteCode, username, domain, embedTitle, embedColor } = req.body;
  let { displayName } = req.body;
  if (!inviteCode || !username) {
    return res.status(400).json({ success: false, error: "Bad Request" });
  }
  if (username.length < 3) {
    return res
      .status(400)
      .json({ success: false, error: "The provided username is too short!" });
  }
  if (!displayName) displayName = username;
  const password = generatePassword();
  const success: boolean = await mongo.invitedUserRegister(
    inviteCode,
    username,
    password,
    embedColor || "#050505",
    embedTitle || displayName || username,
    displayName || username,
  );
  if (!success)
    return res
      .status(500)
      .json({ success: false, error: "Unknown error, please try again." });

  const fileData = Buffer.from(
    JSON.stringify({
      Version: "16.0.1",
      Name: `liba sharex - ${username}`,
      DestinationType: "ImageUploader, FileUploader",
      RequestMethod: "POST",
      RequestURL: `https://${domain}/api/users/upload`,
      Body: "MultipartFormData",
      Arguments: { username: `${username}`, password: `${password}` },
      FileFormName: "file",
      URL: "https://{json:host}{json:path}",
      ThumbnailURL: "https://{json:host}/uploads/og/{json:file_name}",
      DeletionURL: "https://{json:host}/api/delete?token={json:delete_token}",
    }),
  ).toString("base64");

  res.writeHead(200, {
    "Content-Disposition": `attachment; filename="${username}.sxcu"`,
    "Content-Type": "text/plain",
  });
  const download = Buffer.from(fileData, "base64");
  res.end(download);
});

router.post("/users/changePassword", async (req, res) => {
  const { username, newPassword } = req.body;
  const authorization = req.headers.authorization;
  if (authorization !== "Bearer " + process.env.SUPERADMIN_UUID)
    return res.status(401).end("Unauthorized");
  const changed: boolean = await mongo.setPassword(username, newPassword);
  res.status(changed === true ? 200 : 500).end(changed.toString());
});

export default router;
