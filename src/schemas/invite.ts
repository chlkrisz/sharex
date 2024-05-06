import { Schema, Types } from "mongoose";

export const inviteSchema = new Schema({
  _id: Types.ObjectId,
  code: String,
  redeemed: Boolean,
});
