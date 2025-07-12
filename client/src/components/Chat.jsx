import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";

const Chat = ({ room, userName }) => {
  const socket = useSocket();
  const { getUserInfo } = useAuth();
  const userInfo = getUserInfo();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket || !room) return;

    const handleMessage = (message) => {
      // Remove optimistic message if it exists
      setMessages(prev => {
        // Filter out optimistic message with same text and timestamp proximity
        const filteredMessages = prev.filter(msg => 
          !(msg.isOptimistic && 
            msg.text === message.text && 
            msg.user === message.user &&
            Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp || Date.now()).getTime()) < 5000)
        );
        return [...filteredMessages, message];
      });
    };

    const handleHistory = (history) => {
      setMessages(history || []);
    };

    socket.on("chat:message", handleMessage);
    socket.on("chat:history", handleHistory);
    
    const historyTimer = setTimeout(() => {
      socket.emit("requestChatHistory", { room });
    }, 1500);
    
    return () => {
      socket.off("chat:message", handleMessage);
      socket.off("chat:history", handleHistory);
      clearTimeout(historyTimer);
    };
  }, [socket, room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const messageData = {
      room,
      message: {
        text: input.trim(),
        user: userName || userInfo?.name || "Anonymous",
        userId: userInfo?.id || null,
        isAuthenticated: userInfo?.isAuthenticated || false,
      }
    };

    // Optimistically add message to local state for immediate feedback
    const optimisticMessage = {
      ...messageData.message,
      timestamp: new Date().toISOString(),
      isOptimistic: true
    };
    setMessages(prev => [...prev, optimisticMessage]);

    socket.emit("chat:message", messageData);
    setInput("");
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-500 to-gray-600 text-white p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.001 8.001 0 01-7.022-4.152A2.978 2.978 0 003 15.5c0-1.65 1.35-3 3-3h.5c.255 0 .507-.035.75-.1A9.967 9.967 0 0112 12c0 1.742-.449 3.378-1.238 4.8A2.976 2.976 0 0113.5 18.5c0-1.65 1.35-3 3-3h.5c1.65 0 3 1.35 3 3 0 1.65-1.35 3-3 3a2.978 2.978 0 01-2.978-1.848A8.001 8.001 0 0121 12z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Study Chat</h3>
              <p className="text-xs text-white/80">Stay focused together</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-white/20 text-white px-2 py-1 rounded-full text-xs font-medium">
              {messages.length}
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
      
      <div className="h-80 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.001 8.001 0 01-7.022-4.152A2.978 2.978 0 003 15.5c0-1.65 1.35-3 3-3h.5c.255 0 .507-.035.75-.1A9.967 9.967 0 0112 12c0 1.742-.449 3.378-1.238 4.8A2.976 2.976 0 0113.5 18.5c0-1.65 1.35-3 3-3h.5c1.65 0 3 1.35 3 3 0 1.65-1.35 3-3 3a2.978 2.978 0 01-2.978-1.848A8.001 8.001 0 0121 12z" />
              </svg>
              <p className="text-sm">No messages yet</p>
              <p className="text-xs text-gray-400">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOwnMessage = (msg.userId && msg.userId === userInfo?.id) || 
                                  (msg.user === (userName || userInfo?.name)) ||
                                  msg.isOptimistic;
              
              return (
                <div key={index} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                    isOwnMessage 
                      ? 'bg-blue-500 text-white rounded-br-md' 
                      : 'bg-white text-gray-900 rounded-bl-md border border-gray-200'
                  }`}>
                    {!isOwnMessage && (
                      <div className={`text-xs font-medium mb-1 ${
                        msg.isAuthenticated ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {msg.user}
                      </div>
                    )}
                    <p className="text-sm break-words leading-relaxed">{msg.text}</p>
                    <div className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    } flex items-center justify-end space-x-1`}>
                      <span>
                        {formatTimestamp(msg.timestamp || msg.createdAt || new Date().toISOString())}
                      </span>
                      {isOwnMessage && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={sendMessage} className="flex gap-3 items-end">
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 focus-within:bg-gray-50 transition-colors">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-transparent text-sm focus:outline-none placeholder-gray-500"
                maxLength={500}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim()}
              className={`p-2 rounded-full transition-all transform hover:scale-105 ${
                input.trim() 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
