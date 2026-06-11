import React, { useRef, useEffect, useContext, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import useAiFeatures, { REWRITE_TONES } from "../hooks/useAiFeatures";

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
  const [rewriteTone, setRewriteTone] = useState(REWRITE_TONES[0]);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const {
    smartReplies,
    summary,
    imageAnalyses,
    visionAvailable,
    loading,
    refreshSmartReplies,
    rewriteInput,
    generateSummary,
    analyzeImageMessage,
  } = useAiFeatures(selectedUser?._id);

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

const handleRewrite = async () => {
  const rewrittenText = await rewriteInput(input, rewriteTone);
  if (rewrittenText) setInput(rewrittenText);
}

const handleSummary = async () => {
  setIsSummaryOpen(true);
  await generateSummary();
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
          onClick={handleSummary}
          disabled={loading.summary}
          className="text-xs text-white bg-violet-600/70 hover:bg-violet-600 disabled:opacity-60 px-3 py-2 rounded-lg"
        >
          {loading.summary ? "Summarizing..." : "Summarize Chat"}
        </button>
        <img
          onClick={() => setSelectedUser(null)}
          src={assets.help_icon}
          alt=""
          className="md:hidden max-w-5 "
        />
        <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5" />
      </div>
      {/* -------- chat area --------- */}
      <div className="flex flex-col h-[calc(100%-220px)] overflow-y-scroll p-3 pb-6">
        {messages.map((msg, index) => (
          <div
            key={index}
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
                <button
                  onClick={() => analyzeImageMessage(msg._id)}
                  disabled={!visionAvailable || loading.imageId === msg._id}
                  className="mt-2 w-full text-xs text-white bg-gray-700/70 hover:bg-gray-700 disabled:opacity-50 px-3 py-2 rounded-lg"
                >
                  {!visionAvailable
                    ? "Image AI unavailable"
                    : loading.imageId === msg._id
                    ? "Analyzing..."
                    : "Analyze Image"}
                </button>
                {imageAnalyses[msg._id] && (
                  <p className="mt-2 p-2 text-xs text-gray-100 bg-black/30 rounded-lg whitespace-pre-line">
                    {imageAnalyses[msg._id]}
                  </p>
                )}
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
        <div ref={scrollEnd}></div>
      </div>

      {/* ------ bottom area -------- */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {smartReplies.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {smartReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => setInput(reply)}
                className="text-xs text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-3 py-2"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={rewriteTone}
            onChange={(e) => setRewriteTone(e.target.value)}
            className="text-xs text-white bg-gray-800/80 border border-white/10 rounded-lg px-2 py-2 outline-none"
          >
            {REWRITE_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
          <button
            onClick={handleRewrite}
            disabled={loading.rewrite}
            className="text-xs text-white bg-violet-600/70 hover:bg-violet-600 disabled:opacity-60 rounded-lg px-3 py-2"
          >
            {loading.rewrite ? "Rewriting..." : "AI Rewrite"}
          </button>
          <button
            onClick={refreshSmartReplies}
            disabled={loading.smartReplies}
            className="text-xs text-white bg-white/10 hover:bg-white/20 disabled:opacity-60 rounded-lg px-3 py-2"
          >
            {loading.smartReplies ? "Thinking..." : "Smart Replies"}
          </button>
        </div>
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
      {isSummaryOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Chat Summary</h2>
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="text-sm text-gray-300 hover:text-white"
              >
                Close
              </button>
            </div>
            {loading.summary ? (
              <p className="text-sm text-gray-300">Generating summary...</p>
            ) : (
              <p className="text-sm text-gray-200 whitespace-pre-line">{summary}</p>
            )}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
      <img src={assets.logo_icon} className="max-w-16" alt="" />
      <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
    </div>
  );
};

export default ChatContainer;
