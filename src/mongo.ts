import mongoose from 'mongoose';
import 'dotenv/config';
import { userSchema } from './schemas/user';
import { uploadSchema } from './schemas/upload';
import bcrypt from 'bcrypt';
const saltRounds: number = 10;
import path from "path";
import * as fs from 'fs';

const mongoUrl: string = process.env.MONGO_URL!;
mongoose.connect(mongoUrl);

export async function addUser(username: string, password: string): Promise<boolean> {
    if (!username ||!password) return false;
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(password, salt);

    const Users = mongoose.model("users", userSchema);
    
    const exists = await Users.findOne({ 'username': username });

    if (!exists) {
        const user = new Users({
            '_id': new mongoose.Types.ObjectId(),
            'username': username,
            'password': hash
        });

        await user.save();
        return true;
    } else {
        return false;
    }

}

export async function validateLogin(username: string, password: string): Promise<boolean> {

    const Users = mongoose.model("users", userSchema);
    const user = await Users.findOne({ 'username': username });

    if (user && user.password) {
        const match = await bcrypt.compare(password, user.password);
        if (match) return true;
    }

    return false;

}

export async function addUpload(username: string, filename: string, delete_token: string): Promise<boolean> {
    const Uploads = mongoose.model("uploads", uploadSchema);
    const upload = new Uploads({
        "_id": new mongoose.Types.ObjectId(),
        "username": username,
        "filename": filename,
        "delete_token": delete_token
    });

    await upload.save();

    return true;
}

export async function countUploads(): Promise<number> {
    const Uploads = mongoose.model("uploads", uploadSchema);
    const count = await Uploads.countDocuments();

    return count;
}

export async function getDisplayName(filename: string): Promise<string> {
    const Uploads = mongoose.model("uploads", uploadSchema);
    const Users = mongoose.model("users", userSchema);
    const upload = await Uploads.findOne({ 'filename': filename });
    if (!upload || !upload.username) return "unknown";
    const user = await Users.findOne({ 'username': upload.username });


    if (user && user.displayName) return user.displayName;
    if (user && user.username) return user.username;
    return "unknown";
}

export async function getVerifiedStatus(username: string): Promise<boolean> {
    const Users = mongoose.model("users", userSchema);
    const user = await Users.findOne({ 'username': username });
    if (!user || !user.verified) return false;
    return true;
}

export async function getProfilePicture(username: string): Promise<string> {
    const Users = mongoose.model("users", userSchema);
    const user = await Users.findOne({ 'username': username });
    if (!user || !user.profileImg) return "";
    return user.profileImg;
}

export async function getUsername(filename: string): Promise<string> {
    const Uploads = mongoose.model("uploads", uploadSchema);
    const Users = mongoose.model("users", userSchema);
    const upload = await Uploads.findOne({ 'filename': filename });
    if (!upload || !upload.username) return "unknown";
    const user = await Users.findOne({ 'username': upload.username });


    if (user && user.username) return user.username;
    return "unknown";
}

export async function findDeletionToken(token: string): Promise<string> {
    const Uploads = mongoose.model("uploads", uploadSchema);
    const upload = await Uploads.findOne({ 'delete_token': token });


    if (upload && upload.filename) return upload.filename;
    return "";
}

export async function deleteUpload(filename: string): Promise<boolean> {

    const Uploads = mongoose.model("uploads", uploadSchema);
    const upload = await Uploads.findOne({ 'filename': filename });
    if (!upload) {
    
        return false;
    }
    
    const filePath = path.join(__dirname, "/../uploads/", filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    await Uploads.deleteOne({ 'filename': filename });

    return true;

}

export async function setDisplayName(username: string, displayName: string): Promise<boolean> {
    const Users = mongoose.model("users", userSchema);
    const user = await Users.findOne({ 'username': username });
    if (!user) {
    
        return false;
    }

    user.displayName = displayName;
    await user.save();

    return true;
}

export async function setPassword(username: string, newPassword: string): Promise<boolean> {
    const Users = mongoose.model("users", userSchema);
    const user = await Users.findOne({ 'username': username });
    if (!user) return false;

    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(newPassword, salt);
    
    user.password = hash;
    await user.save();

    return true;
}