import "dotenv/config";
export const settings = {
  region: "",
  storage_zone_name: process.env.BUNNY_SZNAME,
  upload_path: "user-uploads/",
  base_url: "https://storage.bunnycdn.com",
  cdn_url: process.env.CDN_URL,
};
import * as fs from "fs";
import axios from "axios";
import path from "path";
import * as crypto from "node:crypto";
import { UploadedFile } from "express-fileupload";

export async function uploadFile(fileName: string) {
  const fileStream = fs.createReadStream(fileName);
  const extension = path.extname(fileName).split(".").pop() || "png";
  const newName = `${crypto.randomUUID()}.${extension}`;
  fileStream.on("error", (error) => {
    console.error(`Error uploading file: ${error.message}`);
  });
  const response = await axios.put(
    `${settings.base_url}/${settings.storage_zone_name}/${settings.upload_path}${newName}`,
    fileStream,
    {
      headers: {
        AccessKey: `${process.env.BUNNY_ACCESS_TOKEN}`,
        "Content-Type": "application/octet-stream",
        Accept: "application/json",
      },
    },
  );

  if (response.status === 201) {
    return settings.upload_path + newName;
  } else {
    return "error.png";
  }
}

export async function uploadFileStream(file: UploadedFile) {
  const fileStream = file.data;
  const extension = path.extname(file.name).split(".").pop() || "png";
  const newName = `${crypto.randomUUID()}.${extension}`;
  const response = await axios.put(
    `${settings.base_url}/${settings.storage_zone_name}/${settings.upload_path}${newName}`,
    fileStream,
    {
      headers: {
        AccessKey: `${process.env.BUNNY_ACCESS_TOKEN}`,
        "Content-Type": file.mimetype,
        Accept: "application/json",
      },
    },
  );

  if (response.status === 201) {
    return settings.upload_path + newName;
  } else {
    return "error.png";
  }
}

export async function deleteFile(filePath: string) {
  const response = await axios.delete(
    `${settings.base_url}/${settings.storage_zone_name}/${filePath}`,
    {
      headers: {
        AccessKey: `${process.env.BUNNY_ACCESS_TOKEN}`,
        Accept: "application/json",
      },
    },
  );

  if (response.status === 200) return true;
  else return false;
}
