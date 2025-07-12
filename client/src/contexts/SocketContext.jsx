import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

// Create the Socket context
export const SocketContext = createContext(null);

// Custom hook for easy access
export const useSocket = () => useContext(SocketContext);

// Provider component
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    // Try to connect with error handling
    let newSocket;
    
    try {
      console.log("Attempting to connect to Socket.IO server...");
      
      // Fix the socket.io client connection for production
      // In development, connect to localhost:5000
      // In production (Vercel), connect to the backend hosted on Render: https://studysync-mern-project.onrender.com
      // Make sure the URL dynamically switches based on environment
      // Also set transports: ["websocket", "polling"] to ensure compatibility with Vercel and avoid connection errors
      const getSocketURL = () => {
        // Always use environment variable first if available
        if (import.meta.env.VITE_API_URL) {
          console.log("🌐 Using VITE_API_URL:", import.meta.env.VITE_API_URL);
          return import.meta.env.VITE_API_URL;
        }
        
        // Production check - if we're on vercel.app domain, use Render backend
        if (window.location.hostname.includes('vercel.app')) {
          console.log("🌐 Vercel production detected - using Render backend");
          return "https://studysync-mern-project.onrender.com";
        }
        
        // Development fallback
        console.log("🔧 Development mode - using localhost");
        return "http://localhost:5000";
      };
      
      const socketURL = getSocketURL();
      console.log("🔗 Socket.IO connecting to:", socketURL);
      console.log("🔍 Environment debug:", {
        hostname: window.location.hostname,
        isProd: import.meta.env.PROD,
        apiUrl: import.meta.env.VITE_API_URL,
        finalURL: socketURL
      });
      console.log("🔍 Environment detection:", {
        'import.meta.env.PROD': import.meta.env.PROD,
        'import.meta.env.MODE': import.meta.env.MODE,
        'import.meta.env.NODE_ENV': import.meta.env.NODE_ENV,
        'window.location.hostname': window.location.hostname,
        'window.location.origin': window.location.origin,
        'VITE_API_URL': import.meta.env.VITE_API_URL,
        'All env vars': Object.keys(import.meta.env)
      });
      
      // Create new socket connection
      newSocket = io(socketURL, {
        withCredentials: true,
        auth: { token }, // Send token for auth
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 20000, // Increase timeout for cross-origin requests
        // Fallback for Vercel - prioritize WebSocket but fallback to polling
        transports: ["websocket", "polling"],
        upgrade: true,
        rememberUpgrade: true,
      });

      // Connection debugging
      newSocket.on('connect', () => {
        console.log('Socket connected successfully:', newSocket.id);
      });
      
      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });
      
      // Set socket in state only if we successfully created it
      setSocket(newSocket);
    } catch (err) {
      console.error("Failed to initialize socket:", err);
    }
    
    return () => {
      if (newSocket) {
        console.log("Disconnecting socket");
        newSocket.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
