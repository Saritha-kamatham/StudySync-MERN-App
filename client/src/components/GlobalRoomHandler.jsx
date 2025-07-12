import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

const GlobalRoomHandler = () => {
  const socket = useSocket();
  const { showWarning } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    const handleGlobalRoomClosed = ({ reason, roomName }) => {
      console.log('🚨 Global: Room closed event received:', { reason, roomName });
      
      // Show toast notification to all users
      showWarning(reason || `Room "${roomName}" has been closed by the host.`, 6000);
      
      // If user is currently in the closed room, redirect them
      const currentPath = window.location.pathname;
      if (currentPath.includes('/room/') && currentPath.includes(roomName)) {
        console.log('🚨 Global: User is in closed room, redirecting...');
        setTimeout(() => {
          navigate('/study-room');
        }, 2000); // Give time for toast to be seen
      }
    };

    // Listen for global room closure events
    socket.on('roomClosed', handleGlobalRoomClosed);

    return () => {
      socket.off('roomClosed', handleGlobalRoomClosed);
    };
  }, [socket, showWarning, navigate]);

  // This component doesn't render anything
  return null;
};

export default GlobalRoomHandler;
