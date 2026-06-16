import { createContext, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "./AuthContext";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null);

  const { socket, axios } = useContext(AuthContext);

  const getUsers = async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const getMessages = async (userId) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}`);
      if (data.success) {
        setMessages(data.messages);
        setFirstUnreadMessageId(data.firstUnreadMessageId || null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const updateMessageInState = (updatedMessage) => {
    setMessages((prevMessages) =>
      prevMessages
        .map((message) =>
          message._id === updatedMessage._id ? updatedMessage : message
        )
        .filter((message) => !message.deletedForEveryone)
    );
  };

  const sendMessage = async (messageData) => {
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );
      if (data.success) {
        setMessages((prevMessages) => [...prevMessages, data.newMessage]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const editMessage = async (messageId, text) => {
    try {
      const { data } = await axios.put(`/api/messages/edit/${messageId}`, {
        text,
      });
      if (data.success) updateMessageInState(data.message);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const deleteMessage = async (messageId, mode = "me") => {
    try {
      const { data } = await axios.put(`/api/messages/delete/${messageId}`, {
        mode,
      });
      if (data.success) {
        if (mode === "me") {
          setMessages((prevMessages) =>
            prevMessages.filter((message) => message._id !== messageId)
          );
        } else {
          updateMessageInState(data.message);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    try {
      const { data } = await axios.put(`/api/messages/react/${messageId}`, {
        emoji,
      });
      if (data.success) updateMessageInState(data.message);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const togglePinMessage = async (messageId) => {
    try {
      const { data } = await axios.put(`/api/messages/pin/${messageId}`);
      if (data.success) updateMessageInState(data.message);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const subscribeToMessages = async () => {
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        newMessage.seen = true;
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        axios.put(`/api/messages/mark/${newMessage._id}`);
      } else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1
            : 1,
        }));
      }
    });

    socket.on("messageUpdated", (updatedMessage) => {
      updateMessageInState(updatedMessage);
    });

    socket.on("messagesSeen", ({ seenBy, seenAt }) => {
      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.receiverId === seenBy
            ? { ...message, seen: true, seenAt }
            : message
        )
      );
    });
  };

  const unsubscribeFromMessages = () => {
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messageUpdated");
    socket.off("messagesSeen");
  };

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    setMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    togglePinMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    getMessages,
    firstUnreadMessageId,
    setFirstUnreadMessageId,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
