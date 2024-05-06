import { Schema, Types } from "mongoose";

export const uploadSchema = new Schema({
  _id: Types.ObjectId,
  username: String,
  filename: String,
  delete_token: String,
});
