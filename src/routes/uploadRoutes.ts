import { Router } from "express";
import { validateLogin, addUpload, deleteUploadWithToken } from "../utils/mongo";
import * as bunny from "../utils/bunny";

const router = Router();

router.post("/users/upload", async (req, res) => {
  if (!req.body.username || !req.body.password) return res.status(401).end();
  const isValid = await validateLogin(req.body.username, req.body.password);

  if (!isValid) return res.status(401).end();

  if (!req.files || !req.files.file) return res.status(400).end();

  const file = req.files.file;

  if (Array.isArray(file)) return res.status(400).send("Only one file at a time is allowed.");

  const fileName =
    (Math.random() + 1).toString(36).substring(2, 12) +
    "." +
    /(?:\.([^.]+))?$/.exec(file.name)![1];
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
    })
  );
});

router.get("/api/delete", async (req, res) => {
  if (!req.query.token) return res.status(401).end();

  const token = req.query.token as string;

  const deleted = await deleteUploadWithToken(token);

  if (deleted) {
    res.status(200).end("File deleted successfully!");
  } else {
    res.status(500).end("There was an error deleting the uploaded file. Did you provide the correct token?");
  }
});

export default router;