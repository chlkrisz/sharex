import "dotenv/config";
const { Storage } = require("@google-cloud/storage");
const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: "credentials.json",
});
import path from 'path';
import fs from 'fs';

import { UploadedFile } from "express-fileupload";

export const settings = {
    CDN_URL: "https://cdn.snaply.pics/",
    PATH: "user-uploads/"
}

export async function uploadFile(file: UploadedFile, fileName: string) {
    try {
        const bucket = storage.bucket(process.env.GOOGLE_BUCKET_NAME);
        const storage_path = `${settings.PATH}${fileName}`;
        
        fs.writeFileSync(path.join(__dirname, "/tmp/"+fileName+".tmp"), file.data, {encoding:'utf8'});
        
        const result = await bucket.upload(path.join(__dirname, "/tmp/"+fileName+".tmp"), {
            destination: storage_path,
            name: fileName
        });

        fs.unlinkSync(path.join(__dirname, "/tmp/"+fileName+".tmp"));
        return result[0].metadata.mediaLink;
    } catch (err) {
        console.error(`Error uploading file: ${err}`);
        throw err;
    }
}

export async function deleteFile(fileName: string) {
    try {
        const bucket = storage.bucket(process.env.GOOGLE_BUCKET_NAME);
        const file_path = `${settings.PATH}${fileName}`;
        const file = bucket.file(file_path);
        await file.delete();
    } catch (err) {
        console.error(`Error deleting file: ${err}`);
        throw err;
    }
}