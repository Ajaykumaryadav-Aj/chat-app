import React, { useRef, useEffect, useContext, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const {
    messages,
    selectedUser,
    sendMessage,
    setSelectedUser,
    getMessages
  } = useContext(ChatContext);

  const {  authUser, onlineUsers } = useContext(AuthContext);
  const [input, setInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const scrollEnd = useRef();


useEffect(() => {
if (selectedUser) {
  getMessages(selectedUser._id)
}
}, [selectedUser])



  useEffect(() => {
    if (scrollEnd.current && messages) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

// Handle sending message 
const handleSendMessage = async (e)=>{
  e.preventDefault();
  if (input.trim() === "") return null ;
  await sendMessage({text: input.trim()});
  setInput("")

}

const buildTranscript = () => {
  if (!selectedUser || !authUser) return "";

  return messages.map((msg) => {
    const sender = msg.senderId === authUser._id ? "Me" : selectedUser.fullName;
    const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "";
    const content = msg.text || (msg.image ? "[Image]" : "");
    return `[${time}] ${sender}: ${content}`;
  }).join("\n");
}

const handleCopyTranscript = async () => {
  const transcript = buildTranscript();
  if (!transcript) {
    toast.error("No messages to copy");
    return;
  }

  await navigator.clipboard.writeText(transcript);
  toast.success("Chat copied");
}

const handleExportTranscript = () => {
  const transcript = buildTranscript();
  if (!transcript) {
    toast.error("No messages to export");
    return;
  }

  const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${selectedUser.fullName || "chat"}-chat.txt`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Chat exported");
}

/// Handle sending an image
const handleSendImage = async (e) =>{
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image/")) {
    toast.error("select an image file")
    return;
  }

  const reader =new FileReader();
  reader.onloadend = async ()=>{
    await sendMessage({image: reader.result})
    e.target.value = ""
  }
  reader.readAsDataURL(file)
}

const normalizedSearch = searchTerm.trim().toLowerCase();
const visibleMessages = normalizedSearch
  ? messages.filter((msg) => (msg.text || "").toLowerCase().includes(normalizedSearch))
  : messages;
const matchCount = normalizedSearch ? visibleMessages.length : messages.length;



  return selectedUser ? (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      {/* -------- header ----------- */}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full" />
        <p className="flex-1 text-lg text-white flex items-center gap-2">
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) &&
          <span className="w-2 h-2 rounded-full bg-green-500"></span>}
        </p>
        <button
          onClick={() => setShowSearch((value) => !value)}
          className="text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg"
        >
          Search
        </button>
        <button
          onClick={handleCopyTranscript}
          className="text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg max-sm:hidden"
        >
          Copy
        </button>
        <button
          onClick={handleExportTranscript}
          className="text-xs text-white bg-violet-600/70 hover:bg-violet-600 px-3 py-2 rounded-lg"
        >
          Export
        </button>
        <img
          onClick={() => setSelectedUser(null)}
          src={assets.help_icon}
          alt=""
          className="md:hidden max-w-5 "
        />
        <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5" />
      </div>
      {showSearch && (
        <div className="mx-4 mt-3 flex items-center gap-2">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            type="text"
            placeholder="Search this chat"
            className="flex-1 text-sm px-3 py-2 bg-gray-100/12 border border-white/10 rounded-lg outline-none text-white placeholder-gray-400"
          />
          <span className="text-xs text-gray-300 min-w-12 text-right">
            {matchCount}
          </span>
        </div>
      )}
      {/* -------- chat area --------- */}
      <div className={`flex flex-col ${showSearch ? "h-[calc(100%-172px)]" : "h-[calc(100%-120px)]"} overflow-y-scroll p-3 pb-6`}>
        {visibleMessages.map((msg, index) => (
          <div
            key={msg._id || index}
            className={`flex items-end gap-2 justify-end ${
              msg.senderId !== authUser._id &&
              "flex flex-row-reverse"
            }`}
          >
            {msg.image ? (
              <div className="mb-8 max-w-[230px]">
                <img
                  src={msg.image}
                  alt=""
                  className="w-full border border-gray-700 rounded-lg overflow-hidden"
                />
              </div>
            ) : (
              <p
                className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8  break-all bg-violet-500/30 text-white ${
                  msg.senderId === authUser._id
                    ? "rounded-br-none"
                    : "rounded-bl-none"
                }`}
              >
                {msg.text}
              </p>
            )}
            <div className="text-center text-xs">
              <img
                src={
                  msg.senderId === authUser._id 
                    ? authUser?.profilePic || assets.avatar_icon 
                    : selectedUser?.profilePic || assets.avatar_icon
                }
                className="w-7 rounded-full"
                alt=""
              />
              <p className="text-gray-500">
                {" "}
                {formatMessageTime(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}
        {visibleMessages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">
            No messages found
          </p>
        )}
        <div ref={scrollEnd}></div>
      </div>

      {/* ------ bottom area -------- */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
          <input
          onChange={(e)=>setInput(e.target.value)}
          value={input}
          onKeyDown={(e)=>e.key === "Enter" ? handleSendMessage(e):null}
            type="text"
            placeholder="send a message"
            className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
          />
          <input onChange={handleSendImage} type="file" id="image" accept="image/png, image/jpeg" hidden />
          <label htmlFor="image">
            <img
              src={assets.gallery_icon}
              alt=""
              className="w-5 mr-2 cursor-pointer"
            />
          </label>
        </div>
        <img onClick={handleSendMessage} src={assets.send_button} alt=" w-7 cursor-pointer" />
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
