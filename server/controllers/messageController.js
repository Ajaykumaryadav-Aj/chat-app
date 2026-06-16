import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

// Get all users except the logged in user

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    // Count number of message not seen
    const unseenMessages = {}
    const promises = filteredUsers.map(async (user) => {
      const message = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });
      if (message.length > 0) {
        unseenMessages[user._id] = message.length;
      }
    });

    await Promise.all(promises);
    res.json({success: true, users: filteredUsers, unseenMessages})
  } catch (error) {
    console.log(error.message);
        res.json({success: false, message: error.message})

    
  }
};


/// Get all message for selected user

export const getMessage = async (req, res) =>{
    try {
       const { id: selectedUserId } = req.params;
       const myId = req.user._id;
       const firstUnreadMessage = await Message.findOne({
        senderId: selectedUserId,
        receiverId: myId,
        seen: false,
        deletedForEveryone: false,
        deletedFor: { $ne: myId },
       }).sort({ createdAt: 1 }).select("_id");

       const messages = await Message.find({
        $or:[
            {senderId:myId, receiverId: selectedUserId},
            {senderId:selectedUserId, receiverId: myId},
        ],
        deletedForEveryone: false,
        deletedFor: { $ne: myId },

       }).sort({ createdAt: 1 });
const seenAt = new Date();
const seenUpdate = await Message.updateMany(
  {senderId: selectedUserId, receiverId:myId, seen:false},
  {seen:true, seenAt}
);
const selectedUserSocketId = userSocketMap[selectedUserId];
if (seenUpdate.modifiedCount > 0 && selectedUserSocketId) {
    io.to(selectedUserSocketId).emit("messagesSeen", { seenBy: myId, seenAt });
}
res.json({success: true, messages, firstUnreadMessageId: firstUnreadMessage?._id || null})

    } catch (error) {
       console.log(error.message);
        res.json({success: false, message: error.message})
 
    }
}


// api to mark message as seen using message id
export const markMessageAsSeen = async (req, res)=>{
    try {
       const { id } = req.params;
       const message = await Message.findByIdAndUpdate(id, {seen: true, seenAt: new Date()}, {new: true}) 
       const senderSocketId = userSocketMap[message?.senderId?.toString()];
       if (senderSocketId) {
        io.to(senderSocketId).emit("messageUpdated", message);
       }
       res.json({success: true})
    } catch (error) {
       console.log(error.message);
        res.json({success: false, message: error.message}) 
    }
}


// Send message to selected user

export const sendMessage = async (req, res) =>{
    try {
        const {text,image, replyTo} = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        let replySnapshot;
        if (replyTo) {
            const replyMessage = await Message.findOne({
                _id: replyTo,
                $or:[
                    {senderId, receiverId},
                    {senderId: receiverId, receiverId: senderId},
                ],
                deletedForEveryone: false,
            });
            if (replyMessage) {
                replySnapshot = {
                    messageId: replyMessage._id,
                    senderId: replyMessage.senderId,
                    text: replyMessage.text,
                    image: replyMessage.image,
                };
            }
        }

        const receiverSocketId = userSocketMap[receiverId];
        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            replyTo: replySnapshot,
            deliveredAt: receiverSocketId ? new Date() : undefined,
        })
// Emit the new message to the receiver's socket
if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", newMessage)
}


res.json({success:true, newMessage});

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message}) 
    }
}

export const editMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const userId = req.user._id;

        if (!text?.trim()) {
            return res.status(400).json({ success: false, message: "Message text is required" });
        }

        const message = await Message.findOneAndUpdate(
            { _id: id, senderId: userId, image: { $exists: false }, deletedForEveryone: false },
            { text: text.trim(), edited: true, editedAt: new Date() },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found or cannot be edited" });
        }

        emitMessageUpdate(message);
        res.json({ success: true, message });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { mode = "me" } = req.body;
        const userId = req.user._id;
        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const belongsToConversation =
            message.senderId.toString() === userId.toString() ||
            message.receiverId.toString() === userId.toString();

        if (!belongsToConversation) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (mode === "everyone") {
            if (message.senderId.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: "Only sender can delete for everyone" });
            }
            message.deletedForEveryone = true;
            message.text = "";
            message.image = "";
        } else if (!message.deletedFor.some((id) => id.toString() === userId.toString())) {
            message.deletedFor.push(userId);
        }

        await message.save();
        emitMessageUpdate(message);
        res.json({ success: true, message });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleReaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;
        const allowedEmojis = ["👍", "❤️", "😂", "😮", "😢"];

        if (!allowedEmojis.includes(emoji)) {
            return res.status(400).json({ success: false, message: "Invalid reaction" });
        }

        const message = await Message.findOne({
            _id: id,
            deletedForEveryone: false,
            $or: [{ senderId: userId }, { receiverId: userId }],
        });

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const existingIndex = message.reactions.findIndex(
            (reaction) => reaction.userId.toString() === userId.toString()
        );

        if (existingIndex >= 0 && message.reactions[existingIndex].emoji === emoji) {
            message.reactions.splice(existingIndex, 1);
        } else if (existingIndex >= 0) {
            message.reactions[existingIndex].emoji = emoji;
        } else {
            message.reactions.push({ userId, emoji });
        }

        await message.save();
        emitMessageUpdate(message);
        res.json({ success: true, message });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const togglePinMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const message = await Message.findOne({
            _id: id,
            deletedForEveryone: false,
            $or: [{ senderId: userId }, { receiverId: userId }],
        });

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        message.pinned = !message.pinned;
        message.pinnedAt = message.pinned ? new Date() : undefined;
        await message.save();
        emitMessageUpdate(message);
        res.json({ success: true, message });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

const emitMessageUpdate = (message) => {
    const senderSocketId = userSocketMap[message.senderId.toString()];
    const receiverSocketId = userSocketMap[message.receiverId.toString()];

    if (senderSocketId) io.to(senderSocketId).emit("messageUpdated", message);
    if (receiverSocketId) io.to(receiverSocketId).emit("messageUpdated", message);
};
