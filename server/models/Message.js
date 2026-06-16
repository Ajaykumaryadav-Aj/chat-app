import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text:{type: String},
    image: {type: String},
    seen: {type: Boolean, default:false},
    seenAt: {type: Date},
    deliveredAt: {type: Date},
    edited: {type: Boolean, default: false},
    editedAt: {type: Date},
    deletedFor: [{type: mongoose.Schema.Types.ObjectId, ref: "User"}],
    deletedForEveryone: {type: Boolean, default: false},
    pinned: {type: Boolean, default: false},
    pinnedAt: {type: Date},
    replyTo: {
        messageId: {type: mongoose.Schema.Types.ObjectId, ref: "Message"},
        senderId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
        text: {type: String},
        image: {type: String},
    },
    reactions: [{
        userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
        emoji: {type: String},
    }]
}, {timestamps:true});

const Message = mongoose.model("Message",messageSchema);
 

export default Message;
