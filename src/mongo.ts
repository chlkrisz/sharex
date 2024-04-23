import mongoose from 'mongoose';
import 'dotenv/config';
import { userSchema } from './schemas/user';
import { uploadSchema } from './schemas/upload';
import bcrypt from 'bcrypt';
const saltRounds: number = 10;
import path from "path";
import * as fs from 'fs';

const mongoUrl: string = process.env.MONGO_URL!;

export async function addUser(username: string, password: string): Promise<boolean> {
    return mongoose.connect(mongoUrl).then(async () => {
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
            await mongoose.connection.close();
            return true;
        } else {
            mongoose.connection.close();
            return false;
        }
    }).catch(err => {
        console.error("Error adding user:", err);
        return false;
    });
}

export async function validateLogin(username: string, password: string): Promise<boolean> {
    return mongoose.connect(mongoUrl).then(async () => {
        const Users = mongoose.model("users", userSchema);
        const user = await Users.findOne({ 'username': username });
        mongoose.connection.close();

        if (user && user.password) {
            const match = await bcrypt.compare(password, user.password);
            if (match) return true;
        }

        return false;
    });
}

export async function addUpload(username: string, filename: string, delete_token: string): Promise<boolean> {
    return mongoose.connect(mongoUrl).then(async ()=>{
        const Uploads = mongoose.model("uploads", uploadSchema);
        const upload = new Uploads({
            "_id": new mongoose.Types.ObjectId(),
            "username": username,
            "filename": filename,
            "delete_token": delete_token
        });

        await upload.save();
        await mongoose.connection.close();
        return true;
    }).catch(err => {
        console.error("Error adding upload:", err);
        return false;
    })
}

export async function countUploads(): Promise<number> {
    return mongoose.connect(mongoUrl).then(async ()=>{
        const Uploads = mongoose.model("uploads", uploadSchema);
        const count = await Uploads.countDocuments();
        await mongoose.connection.close();
        return count;
    }).catch(err => {
        console.error("Error counting uploads:", err);
        return 0;
    })
}

export async function getFileAuthor(filename: string): Promise<string> {
    return mongoose.connect(mongoUrl).then(async()=>{
        const Uploads = mongoose.model("uploads", uploadSchema);
        const Users = mongoose.model("users", userSchema);
        const upload = await Uploads.findOne({ 'filename': filename });
        if (!upload || !upload.username) return "unknown";
        const user = await Users.findOne({ 'username': upload.username });
        await mongoose.connection.close();

        if (user && user.displayName) return user.displayName;
        return "unknown";
    }).catch(err => {
        console.error("Error getting file author:", err);
        return "unknown";
    })
}

export async function findDeletionToken(token: string): Promise<string> {
    return mongoose.connect(mongoUrl).then(async ()=>{
        const Uploads = mongoose.model("uploads", uploadSchema);
        const upload = await Uploads.findOne({ 'delete_token': token });
        await mongoose.connection.close();

        if (upload && upload.filename) return upload.filename;
        return "";
    }).catch(err => {
        console.error("Error finding deletion token:", err);
        return "";
    })
}

export async function deleteUpload(filename: string): Promise<boolean> {
    return mongoose.connect(mongoUrl).then(async ()=>{
        const Uploads = mongoose.model("uploads", uploadSchema);
        const upload = await Uploads.findOne({ 'filename': filename });
        if (!upload) {
            await mongoose.connection.close();
            return false;
        }
        
        const filePath = path.join(__dirname, "/../uploads/", filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        await Uploads.deleteOne({ 'filename': filename });
        await mongoose.connection.close();
        return true;
    }).catch(err => {
        console.error("Error deleting upload:", err);
        return false;
    })

}

export async function setDisplayName(username: string, displayName: string): Promise<boolean> {
    return mongoose.connect(mongoUrl).then(async()=>{
        const Users = mongoose.model("users", userSchema);
        const user = await Users.findOne({ 'username': username });
        if (!user) {
            await mongoose.connection.close();
            return false;
        }

        user.displayName = displayName;
        await user.save();
        await mongoose.connection.close();
        return true;
    }).catch(err=>{
        return false;
    })
}

export async function setPassword(username: string, newPassword: string): Promise<boolean> {
    return mongoose.connect(mongoUrl).then(async()=>{
        const Users = mongoose.model("users", userSchema);
        const user = await Users.findOne({ 'username': username });
        if (!user) {
            await mongoose.connection.close();
            return false;
        }

        const salt = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(newPassword, salt);
        
        user.password = hash;
        await user.save();
        await mongoose.connection.close();
        return true;
    }).catch(err=>{
        return false;
    })
}