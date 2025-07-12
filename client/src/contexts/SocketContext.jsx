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
        if (import.meta.env.PROD) {
          // In production, use the API URL or current domain
          return import.meta.env.VITE_API_URL || window.location.origin;
        }
        // In development, use localhost
        return "http://localhost:5000";
      };
      
      // Create new socket connection
      newSocket = io(getSocketURL(), {
        withCredentials: true,
        auth: { token }, // Send token for auth
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000, // Increase timeout
        transports: ['websocket', 'polling'], // Try both transports
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
