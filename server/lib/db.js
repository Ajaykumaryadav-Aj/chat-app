import mongoose from "mongoose";
import Message from "../models/Message.js";

// Function to connect to the mongodb database
 export const connectDB = async ()=>{
try {
    mongoose.connection.on('connected', ()=> console.log('Database Connected'));
    await mongoose.connect(`${process.env.MONGODB_URI}/chat-app`)
    await normalizeLegacyMessages();
} catch (error) {
 console.log(error);   
}

 }

const normalizeLegacyMessages = async () => {
    await Promise.all([
        Message.updateMany(
            { deletedForEveryone: { $exists: false } },
            { $set: { deletedForEveryone: false } }
        ),
        Message.updateMany(
            { deletedFor: { $exists: false } },
            { $set: { deletedFor: [] } }
        ),
        Message.updateMany(
            { reactions: { $exists: false } },
            { $set: { reactions: [] } }
        ),
    ]);
};
