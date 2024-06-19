import {Schema , model} from "mongoose";

const chatSchema = new Schema({
    users: {
      type: Array,
      required: true
    },
    messages: [
        {
            user : String,
            msg : String,
            createdAt : {type : Date, default : Date.now}
        }
    ]
  });
  
  const Chat = model('Chat', chatSchema);
  
 export default Chat;
  