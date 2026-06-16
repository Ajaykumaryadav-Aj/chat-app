import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import User from "./models/User.js";
import { Server } from "socket.io";

// Create Express app and http server
const app = express();
const server = http.createServer(app)


// Initialize socket.io server
export const io = new Server(server, {
    cors: {origin: "*"}
})

// Store online users
export const userSocketMap = {};  // userId: socketId


// Socket.io connection handler
io.on("connection", (socket)=>{
    const userId = socket.handshake.query.userId;
    console.log("User Connected", userId);

    if (userId) userSocketMap[userId] = socket.id;

    // Emit online users to all connnected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("typing:start", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId && userId) {
            io.to(receiverSocketId).emit("typing:start", { senderId: userId });
        }
    });

    socket.on("typing:stop", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId && userId) {
            io.to(receiverSocketId).emit("typing:stop", { senderId: userId });
        }
    });

    socket.on("disconnect", async ()=>{
        console.log("User Disconnected", userId);
        if (userId) {
            await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
        }
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap))
    })
        
    
    
})


// Middleware setup
app.use(express.json({limit: "4mb"}));
app.use(cors());

// Routes Setup
app.use("/api/status", (req, res)=> res.send("Server is Live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

// Connect to MongoDB
await connectDB();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log("Server is running on PORT:" + PORT));

export default server;
