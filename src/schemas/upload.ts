import { Schema, Types } from "mongoose";

export const uploadSchema = new Schema({
  _id: Types.ObjectId,
  username: String,
  filename: String,
  file_url: String,
  delete_token: String,
});
