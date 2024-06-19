// models/user.js
import { Schema, model } from "mongoose";

const invitSchema = new Schema({
  sender: {
    type: String,
    required: true,
  },
  receiver: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: "pending"
  },
  createdAt: { type: Date, default: Date.now },
});

const Invitation = model("Invitation", invitSchema);

export default Invitation;
