import express from "express";
import Chat from "./model/chat.js";
import User from "./model/user.js";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import http from "http";
import Friends from "./model/friends.js";
import Invitation from "./model/invit.js";
import { log } from "console";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
  },
});

app.use(cors({ origin: ["http://localhost:3000"] }));
app.use(express.json());

server.listen(4000, () => {
  console.log("Server connected on port 4000");
});

mongoose.connect("mongodb://127.0.0.1:27017/Chats").then(() => {
  console.log("DB connected");
});

app.post("/getMsgs", async (req, res) => {
  try {
    const { user1, user2 } = req.body;
    const conversation = await Chat.find({ users: { $all: [user1, user2] } });
    res.send(conversation);
  } catch (error) {
    res.status(500).send("Error retrieving messages");
  }
});

app.post("/SendMsg", async (req, res) => {
  try {
    const { user1, user2, msg } = req.body;
    const conversation = await Chat.findOne({
      users: { $all: [user1, user2] },
    });

    if (!conversation) {
      const newChat = new Chat({
        users: [user1, user2],
        messages: [{ user: user1, msg }],
      });
      await newChat.save();
      io.emit("message", newChat); // Emit the new message
      res.send(newChat); // Return the newly created chat
    } else {
      conversation.messages.push({ user: user1, msg });
      await conversation.save();
      io.emit("message", conversation); // Emit the updated conversation
      res.send(conversation); // Return the updated conversation
    }
  } catch (error) {
    res.status(500).send("Error sending message");
  }
});

app.post("/CreateUser", async (req, res) => {
  try {
    const data = req.body;
    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { name: data.name }],
    });
    if (existingUser) {
      return res.status(400).send("Username or email already exists");
    }
    const newUser = new User(data);
    await newUser.save();
    const newCollection = new Friends({ user: newUser.name, friends: [] });
    await newCollection.save();
    res.send("User created");
  } catch (error) {
    res.status(500).send("Error creating user");
  }
});

app.post("/LogIn", async (req, res) => {
  try {
    const data = req.body;
    const existingUser = await User.findOne({
      email: data.email,
      password: data.password,
    });
    if (existingUser) {
      res.send(existingUser);
    } else {
      res.status(200).send("User does not exist");
    }
  } catch (error) {
    res.status(200).send("Error logging in");
  }
});

app.get("/users/:user", async (req, res) => {
  try {
    const { user } = req.params;

    // Find the user's friends
    const friends = await Friends.findOne({ user });

    // Extract an array of friend names or initialize an empty array if no friends are found
    const friendNames = friends
      ? friends.friends.map((friend) => friend.friend)
      : [];

    // Find users who are not the specified user and not in the friendNames array
    const users = await User.find({
      name: { $ne: user, $nin: friendNames },
    });

    res.send(users);
  } catch (error) {
    res.status(500).send("Error retrieving users");
  }
});

app.post("/CreateUser", async (req, res) => {
  try {
    const data = req.body;
    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { name: data.name }],
    });
    if (existingUser) {
      return res.status(204).send("Username or email already exists");
    }
    const newUser = new User(data);
    await newUser.save();

    const newCollection = new Friends({ user: newUser.name, friends: [] });
    await newCollection.save();

    res.send("User created");
  } catch (error) {
    res.status(202).send("Error creating user");
  }
});

app.post("/search", async (req, res) => {
  try {
    const user = req.body.user;
    const users = await User.find({
      $or: [{ name: user }, { email: user }],
    });
    res.send(users);
  } catch (error) {
    res.status(500).send("Error searching for users");
  }
});

app.get("/getInvitations/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const invitations = await Invitation.find({
      receiver: user,
      status: "pending",
    });
    res.send(invitations);
  } catch (error) {
    res.status(500).send("Error retrieving invitations");
  }
});

app.post("/Invit", async (req, res) => {
  try {
    const { sender, receiver, status } = req.body;

    // Check if an invitation already exists between the sender and receiver
    const existingInvitation = await Invitation.findOne({ sender, receiver });
    if (existingInvitation) {
      return res.status(202).send("Invitation already exists");
    }
    const doublicateInviting = await Invitation.findOne({
      sender: receiver,
      receiver: sender,
    });

    // Create a new invitation
    if (doublicateInviting) {
      await Friends.findOneAndUpdate(
        { user: receiver },
        { $addToSet: { friends: { friend: sender } } },
        { upsert: true, new: true }
      );

      // Add receiver to sender's friends array
      await Friends.findOneAndUpdate(
        { user: sender },
        { $addToSet: { friends: { friend: receiver } } },
        { upsert: true, new: true }
      );
      doublicateInviting.updateOne({status : "accepted"})
      await doublicateInviting.save()
    } else {

      const newInvitation = new Invitation({ sender, receiver, status });
      await newInvitation.save();
  
      res.send("Invitation sent");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error sending invitation");
  }
});
// In your Node.js + Express server
app.put("/accepteInvit", async (req, res) => {
  try {
    const { id } = req.body.data;
    log(id)
    // Find and update the invitation status to accepted
    const invitation = await Invitation.findOneAndUpdate(
      { _id : id.id , status: "pending"},
      { status: "accepted" },
      { new: true }
    );

    if (!invitation) {
      return res.status(404).send("Invitation not found or already accepted");
    }

    // Add sender to receiver's friends array
    await Friends.findOneAndUpdate(
      { user: invitation.receiver },
      { $addToSet: { friends: { friend: invitation.sender } } },
      { upsert: true, new: true }
    );

    // Add receiver to sender's friends array
    await Friends.findOneAndUpdate(
      { user: invitation.sender },
      { $addToSet: { friends: { friend: invitation.receiver } } },
      { upsert: true, new: true }
    );

    res.status(200).send("Accepted");
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).send("An error occurred while accepting the invitation");
  }
});


app.delete("/refuseInvitation", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).send("ID is required");
    }

    await Invitation.findByIdAndDelete(id);

    // Emit an event to all connected clients
    io.emit("invitationRefused", id);

    res.status(200).send("Invitation refused");
  } catch (error) {
    res.status(500).send("An error occurred while refusing the invitation");
  }
});

app.get("/friends/:user", async (req, res) => {
  try {
    const { user } = req.params;
    const friends = await Friends.findOne({ user });
    res.send(friends);
  } catch (error) {
    res.status(500).send("Error retrieving friends");
  }
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("acceptInvitation", async (invitationId) => {
    try {
      const invitation = await Invitation.findOneAndUpdate(
        { _id: invitationId, status: "pending" },
        { status: "accepted" },
        { new: true }
      );

      if (!invitation) {
        return socket.emit("error", "Invitation not found or already accepted");
      }

      // Add sender to receiver's friends array
      await Friends.findOneAndUpdate(
        { user: invitation.receiver },
        { $addToSet: { friends: { friend: invitation.sender } } },
        { upsert: true, new: true }
      );

      // Add receiver to sender's friends array
      await Friends.findOneAndUpdate(
        { user: invitation.sender },
        { $addToSet: { friends: { friend: invitation.receiver } } },
        { upsert: true, new: true }
      );

      socket.emit("invitationAccepted", invitation);
    } catch (error) {
      socket.emit("error", "Error accepting invitation");
    }
  });

  socket.on("refuseInvitation", async (invitationId) => {
    try {
      await Invitation.findByIdAndDelete(invitationId);

      // Emit an event to all connected clients
      io.emit("invitationRefused", invitationId);

      socket.emit("invitationRefused", invitationId);
    } catch (error) {
      socket.emit("error", "Error refusing invitation");
    }
  });
});