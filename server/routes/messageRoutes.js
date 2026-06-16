import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { deleteMessage, editMessage, getMessage, getUsersForSidebar, markMessageAsSeen, sendMessage, togglePinMessage, toggleReaction } from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessage);
messageRouter.put("/mark/:id", protectRoute, markMessageAsSeen);
messageRouter.put("/edit/:id", protectRoute, editMessage);
messageRouter.put("/delete/:id", protectRoute, deleteMessage);
messageRouter.put("/react/:id", protectRoute, toggleReaction);
messageRouter.put("/pin/:id", protectRoute, togglePinMessage);
messageRouter.post("/send/:id", protectRoute, sendMessage)


export default messageRouter;
