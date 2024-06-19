// models/user.js
import { Schema, model } from "mongoose";

const friendsSchema = new Schema({
  user : {
    type : String,
    inique : true
  },
  friends : [
    {
        friend : String
    }
  ]
});

const Friends = model("Friend", friendsSchema);

export default Friends;
