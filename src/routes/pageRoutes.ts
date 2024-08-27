import { Router } from "express";
import path from "path";
import * as mongo from "../utils/mongo";
import * as bunny from "../utils/bunny";

const router = Router();

router.get("/register", (_, res) => {
  res.sendFile(path.join(__dirname, "../public/register.html"));
});

router.get("/terms", (_, res) => {
  res.sendFile(path.join(__dirname, "../public/terms.html"));
});

router.get("/tos", (_, res) => {
  res.redirect("/terms");
});

router.get("/terms-of-service", (_, res) => {
  res.redirect("/terms");
});

router.get("/thanks", (_, res) => {
  res.sendFile(path.join(__dirname, "../public/thanks.html"));
});

router.get("/uploads", (_, res) => {
  res.redirect("https://www.youtube.com/watch?v=WsBv8--PX3o");
});

router.get("/uploads/og", (_, res) => {
  res.redirect("https://www.youtube.com/watch?v=WsBv8--PX3o");
});

router.get("/uploads/:img", (req, res) => {
  res.redirect("../" + req.params.img);
});

router.get("/:img", async (req, res) => {
  if (!/.(jpg|jpeg|png|gif|bmp|svg|mp4)$/.test(req.params.img)) {
    return;
  }
  const userData = await mongo.getUserDataByUpload(req.params.img);
  const uploadData = await mongo.getUploadData(req.params.img);
  if (!userData) return res.end();
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
    return res.setHeader("Cache-Control", "max-age=3600, must-revalidate")
      .send(`
        <!doctype html>
        <html>
          <head>
            <meta property="og:author" content="${userData["embed"]["title"]}">
            <meta property="og:title" content="‎‎‎‎‎‎‎‎">
            <meta name="theme-color" content="${userData["embed"]["color"]}">
            <meta property="og:image" content="${uploadData["url"]}">
            <link type="application/json+oembed" href="https://${req.headers.host}/api/oembed?author=${userData["embed"]["title"]}&file=${req.params.img}" />
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:image" content="${uploadData["url"]}">
            <meta http-equiv="Cache-Control" content="no-cache, no-store, must-refresh">
            <meta http-equiv="Pragma" content="no-cache">
            <meta http-equiv="Expires" content="0">
            <meta http-equiv="refresh" content="0; url=${uploadData["url"]}">
          </head>
        </html>
      `);
  }

  res
    .setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; " +
        "style-src 'self' 'unsafe-inline' *; " +
        `img-src 'self' ${bunny.settings.cdn_url} data:; ` +
        "font-src 'self' https://fonts.gstatic.com https://unpkg.com;",
    )
    .render("imageViewer", {
      coverImg: uploadData["url"],
      author: userData["displayName"] || userData["username"],
      authorImg: userData["profilePicture"]
        ? `${bunny.settings.cdn_url + "avatars/" + userData["profilePicture"]}`
        : `https://${req.headers.host}/assets/img/placeholder.png`,
      fileName: req.params.img,
      verified: (await userData["verified"]) ? `block` : `none`,
      timestamp: ~~(Date.now() / 1000)
    });
});

export default router;
