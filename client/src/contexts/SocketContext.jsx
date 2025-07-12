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
      
      // Initialize socket.io-client with dynamic URL from environment variable
      // Use VITE_API_URL as the backend endpoint instead of localhost
      // This should work in both development and production (Render + Vercel)
      // Enable websocket transport and allow credentials
      const getSocketURL = () => {
        // Hardcoded production check - if we're on vercel.app domain, use production URL
        if (window.location.hostname.includes('vercel.app')) {
          console.log("🌐 Vercel production detected - using hardcoded production URL");
          return "https://study-sync-mern-project.vercel.app";
        }
        
        // Check if we're in production by domain or environment
        const isProduction = window.location.hostname.includes('vercel.app') || 
                           window.location.hostname.includes('netlify.app') ||
                           import.meta.env.PROD;
        
        if (isProduction) {
          const prodURL = import.meta.env.VITE_API_URL || "https://study-sync-mern-project.vercel.app";
          console.log("🌐 Production mode detected - using URL:", prodURL);
          return prodURL;
        }
        
        // In development, use localhost
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
        timeout: 20000, // Increase timeout for Vercel
        // For Vercel deployment, prioritize polling over websockets
        transports: import.meta.env.PROD ? ['polling', 'websocket'] : ['websocket', 'polling'],
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
