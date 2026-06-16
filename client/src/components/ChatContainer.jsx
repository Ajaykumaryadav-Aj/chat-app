import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

const ChatContainer = () => {
  const {
    messages,
    selectedUser,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    togglePinMessage,
    setSelectedUser,
    getMessages,
    firstUnreadMessageId,
    setFirstUnreadMessageId,
  } = useContext(ChatContext);

  const { authUser, onlineUsers, socket } = useContext(AuthContext);
  const [input, setInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const typingTimeout = useRef(null);
  const scrollEnd = useRef();

  useEffect(() => {
    if (selectedUser) getMessages(selectedUser._id);
    setInput("");
    setReplyTo(null);
    setSearchTerm("");
    setFirstUnreadMessageId(null);
  }, [selectedUser]);

  useEffect(() => {
    if (scrollEnd.current && messages) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleTypingStart = ({ senderId }) => {
      setTypingUserIds((prev) => (prev.includes(senderId) ? prev : [...prev, senderId]));
    };
    const handleTypingStop = ({ senderId }) => {
      setTypingUserIds((prev) => prev.filter((id) => id !== senderId));
    };

    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const pinnedMessages = useMemo(
    () => messages.filter((msg) => msg.pinned && !msg.deletedForEveryone),
    [messages]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleMessages = normalizedSearch
    ? messages.filter((msg) => (msg.text || "").toLowerCase().includes(normalizedSearch))
    : messages;
  const matchCount = normalizedSearch ? visibleMessages.length : messages.length;
  const isTyping = selectedUser && typingUserIds.includes(selectedUser._id);

  const emitTyping = () => {
    if (!socket || !selectedUser) return;
    socket.emit("typing:start", { receiverId: selectedUser._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing:stop", { receiverId: selectedUser._id });
    }, 1000);
  };

  const stopTyping = () => {
    if (!socket || !selectedUser) return;
    clearTimeout(typingTimeout.current);
    socket.emit("typing:stop", { receiverId: selectedUser._id });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return;
    await sendMessage({ text: input.trim(), replyTo: replyTo?._id });
    setInput("");
    setReplyTo(null);
    stopTyping();
  };

  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      await sendMessage({ image: reader.result, replyTo: replyTo?._id });
      setReplyTo(null);
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const buildTranscript = () => {
    if (!selectedUser || !authUser) return "";

    return messages
      .map((msg) => {
        const sender = msg.senderId === authUser._id ? "Me" : selectedUser.fullName;
        const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "";
        const content = msg.text || (msg.image ? "[Image]" : "");
        return `[${time}] ${sender}: ${content}`;
      })
      .join("\n");
  };

  const handleCopyTranscript = async () => {
    const transcript = buildTranscript();
    if (!transcript) return toast.error("No messages to copy");
    await navigator.clipboard.writeText(transcript);
    toast.success("Chat copied");
  };

  const handleExportTranscript = () => {
    const transcript = buildTranscript();
    if (!transcript) return toast.error("No messages to export");

    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedUser.fullName || "chat"}-chat.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported");
  };

  const handleEditMessage = (msg) => {
    const nextText = window.prompt("Edit message", msg.text || "");
    if (nextText === null) return;
    if (!nextText.trim()) return toast.error("Message cannot be empty");
    editMessage(msg._id, nextText.trim());
    setOpenMenuId(null);
  };

  const handleMenuAction = (action) => {
    action();
    setOpenMenuId(null);
  };

  const getMessageStatus = (msg) => {
    if (msg.seen) return "Seen";
    if (msg.deliveredAt) return "Delivered";
    return "Sent";
  };

  const getLastSeenText = () => {
    if (!selectedUser?.lastSeen) return "Offline";
    const date = new Date(selectedUser.lastSeen);
    const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMinutes < 1) return "Last seen just now";
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
    return `Last seen ${date.toLocaleString()}`;
  };

  const messagePreview = (msg) => msg?.text || (msg?.image ? "Image" : "Message");

  return selectedUser ? (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="text-lg text-white flex items-center gap-2 truncate">
            {selectedUser.fullName}
            {onlineUsers.includes(selectedUser._id) && (
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            )}
          </p>
          <p className="text-xs text-gray-400">
            {onlineUsers.includes(selectedUser._id) ? "Online" : getLastSeenText()}
            {isTyping && " · typing..."}
          </p>
        </div>
        <button onClick={() => setShowSearch((value) => !value)} className="text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg">
          Search
        </button>
        <button onClick={handleCopyTranscript} className="text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg max-sm:hidden">
          Copy
        </button>
        <button onClick={handleExportTranscript} className="text-xs text-white bg-violet-600/70 hover:bg-violet-600 px-3 py-2 rounded-lg">
          Export
        </button>
        <img onClick={() => setSelectedUser(null)} src={assets.help_icon} alt="" className="md:hidden max-w-5" />
        <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5" />
      </div>

      {pinnedMessages.length > 0 && (
        <button
          onClick={() => document.getElementById(`msg-${pinnedMessages[0]._id}`)?.scrollIntoView({ behavior: "smooth" })}
          className="mx-4 mt-3 w-[calc(100%-2rem)] text-left text-xs text-white bg-yellow-500/15 border border-yellow-400/20 px-3 py-2 rounded-lg"
        >
          Pinned: {messagePreview(pinnedMessages[pinnedMessages.length - 1])}
        </button>
      )}

      {showSearch && (
        <div className="mx-4 mt-3 flex items-center gap-2">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            type="text"
            placeholder="Search this chat"
            className="flex-1 text-sm px-3 py-2 bg-gray-100/12 border border-white/10 rounded-lg outline-none text-white placeholder-gray-400"
          />
          <span className="text-xs text-gray-300 min-w-12 text-right">{matchCount}</span>
        </div>
      )}

      <div className={`flex flex-col ${showSearch || pinnedMessages.length ? "h-[calc(100%-186px)]" : "h-[calc(100%-120px)]"} overflow-y-scroll p-3 pb-6`}>
        {visibleMessages.map((msg, index) => {
          const isMine = msg.senderId === authUser._id;
          const showUnreadDivider = firstUnreadMessageId && msg._id === firstUnreadMessageId;

          return (
            <React.Fragment key={msg._id || index}>
              {showUnreadDivider && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-violet-400/30"></span>
                  <span className="text-xs text-violet-200 bg-violet-500/20 px-3 py-1 rounded-full">
                    New messages
                  </span>
                  <span className="h-px flex-1 bg-violet-400/30"></span>
                </div>
              )}
              <div
                id={`msg-${msg._id}`}
                className={`group flex items-end gap-2 justify-end ${!isMine && "flex flex-row-reverse"}`}
              >
                <div className={`mb-8 max-w-[240px] ${isMine ? "items-end" : "items-start"} flex flex-col relative`}>
                  {msg.replyTo?.messageId && (
                    <button
                      onClick={() => document.getElementById(`msg-${msg.replyTo.messageId}`)?.scrollIntoView({ behavior: "smooth" })}
                      className="mb-1 w-full text-left text-xs text-gray-200 bg-white/10 border-l-2 border-violet-400 px-2 py-1 rounded"
                    >
                      {msg.replyTo.text || (msg.replyTo.image ? "Image" : "Reply")}
                    </button>
                  )}

                  {msg.image ? (
                    <img src={msg.image} alt="" className="w-full border border-gray-700 rounded-lg overflow-hidden" />
                  ) : (
                    <p
                      className={`p-2 max-w-[220px] md:text-sm font-light rounded-lg break-words bg-violet-500/30 text-white ${
                        isMine ? "rounded-br-none" : "rounded-bl-none"
                      }`}
                    >
                      {msg.text}
                      {msg.edited && <span className="ml-2 text-[10px] text-gray-300">(edited)</span>}
                    </p>
                  )}

                  {msg.reactions?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.reactions.map((reaction) => (
                        <span key={`${reaction.userId}-${reaction.emoji}`} className="text-xs bg-white/10 px-2 py-1 rounded-full">
                          {reaction.emoji}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={`absolute top-0 ${isMine ? "-left-8" : "-right-8"}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((currentId) => (currentId === msg._id ? null : msg._id));
                      }}
                      className="w-7 h-7 rounded-full bg-black/25 hover:bg-black/45 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      aria-label="Message options"
                    >
                      ...
                    </button>

                    {openMenuId === msg._id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute top-8 z-20 w-40 rounded-lg border border-white/10 bg-[#171225] shadow-xl overflow-hidden ${
                          isMine ? "right-0" : "left-0"
                        }`}
                      >
                        <button onClick={() => handleMenuAction(() => setReplyTo(msg))} className="w-full text-left text-xs text-white hover:bg-white/10 px-3 py-2">
                          Reply
                        </button>
                        <button onClick={() => handleMenuAction(() => togglePinMessage(msg._id))} className="w-full text-left text-xs text-white hover:bg-white/10 px-3 py-2">
                          {msg.pinned ? "Unpin" : "Pin"}
                        </button>
                        {isMine && !msg.image && (
                          <button onClick={() => handleEditMessage(msg)} className="w-full text-left text-xs text-white hover:bg-white/10 px-3 py-2">
                            Edit
                          </button>
                        )}
                        <button onClick={() => handleMenuAction(() => deleteMessage(msg._id, "me"))} className="w-full text-left text-xs text-white hover:bg-white/10 px-3 py-2">
                          Delete for me
                        </button>
                        {isMine && (
                          <button onClick={() => handleMenuAction(() => deleteMessage(msg._id, "everyone"))} className="w-full text-left text-xs text-red-200 hover:bg-red-500/15 px-3 py-2">
                            Delete for all
                          </button>
                        )}
                        <div className="flex items-center gap-1 border-t border-white/10 px-2 py-2">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button key={emoji} onClick={() => handleMenuAction(() => reactToMessage(msg._id, emoji))} className="flex-1 rounded hover:bg-white/10 text-sm py-1">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center text-xs">
                  <img
                    src={isMine ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon}
                    className="w-7 rounded-full"
                    alt=""
                  />
                  <p className="text-gray-500">{formatMessageTime(msg.createdAt)}</p>
                  {isMine && <p className="text-[10px] text-violet-200">{getMessageStatus(msg)}</p>}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {visibleMessages.length === 0 && <p className="text-center text-sm text-gray-400 mt-8">No messages found</p>}
        {isTyping && <p className="text-xs text-gray-300 px-4 pb-2">{selectedUser.fullName} is typing...</p>}
        <div ref={scrollEnd}></div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 bg-white/10 border-l-2 border-violet-400 px-3 py-2 rounded-lg text-white">
            <p className="flex-1 text-xs truncate">Replying to: {messagePreview(replyTo)}</p>
            <button onClick={() => setReplyTo(null)} className="text-xs text-gray-300 hover:text-white">Cancel</button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
            <input
              onChange={(e) => {
                setInput(e.target.value);
                emitTyping();
              }}
              value={input}
              onBlur={stopTyping}
              onKeyDown={(e) => (e.key === "Enter" ? handleSendMessage(e) : null)}
              type="text"
              placeholder="send a message"
              className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
            />
            <input onChange={handleSendImage} type="file" id="image" accept="image/png, image/jpeg" hidden />
            <label htmlFor="image">
              <img src={assets.gallery_icon} alt="" className="w-5 mr-2 cursor-pointer" />
            </label>
          </div>
          <img onClick={handleSendMessage} src={assets.send_button} alt="send" className="w-7 cursor-pointer" />
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
      <img src={assets.logo_icon} className="max-w-16" alt="" />
      <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
    </div>
  );
};

export default ChatContainer;
