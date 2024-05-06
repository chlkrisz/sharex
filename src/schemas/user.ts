import { Schema, Types } from "mongoose";

export const userSchema = new Schema({
  _id: Types.ObjectId,
  username: String,
  password: String,
  displayName: String,
  profileImg: String,
  verified: Boolean,
});
