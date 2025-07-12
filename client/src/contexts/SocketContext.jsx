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
      
      // Determine socket server URL based on environment
      const getSocketURL = () => {
        // Check if we're in production (multiple ways to detect)
        const isProduction = 
          import.meta.env.PROD || 
          import.meta.env.NODE_ENV === 'production' ||
          window.location.hostname.includes('vercel.app') ||
          window.location.hostname.includes('study-sync-mern-project');
        
        if (isProduction) {
          // In production, use the production URL
          return "https://study-sync-mern-project.vercel.app";
        }
        // In development, use localhost
        return "http://localhost:5000";
      };
      
      const socketURL = getSocketURL();
      console.log("🔗 Socket.IO connecting to:", socketURL);
      console.log("🔍 Environment detection:", {
        'import.meta.env.PROD': import.meta.env.PROD,
        'import.meta.env.NODE_ENV': import.meta.env.NODE_ENV,
        'window.location.hostname': window.location.hostname,
        'VITE_API_URL': import.meta.env.VITE_API_URL
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
