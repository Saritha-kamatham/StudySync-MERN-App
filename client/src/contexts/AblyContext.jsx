import React, { createContext, useContext, useEffect, useState } from 'react';
import { Realtime } from 'ably';

const AblyContext = createContext(null);

export const useAbly = () => useContext(AblyContext);

export const AblyProvider = ({ children }) => {
  const [ably, setAbly] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [channels, setChannels] = useState({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    // Initialize Ably client
    const ablyClient = new Realtime({
      key: import.meta.env.VITE_ABLY_API_KEY || 'niqStg.yXFmMw:-wZQJLmWvx9y_Sx7VDHDfKCyzk-sbocjQF-WNfPFjI4',
      clientId: token ? `user-${Date.now()}` : `anonymous-${Date.now()}`,
      authCallback: async (tokenParams, callback) => {
        // Optional: Implement server-side token authentication
        // For now, using API key directly (suitable for development)
        callback(null, { token: null });
      }
    });

    // Connection event handlers
    ablyClient.connection.on('connected', () => {
      console.log('Ably: Connected successfully');
      setIsConnected(true);
    });

    ablyClient.connection.on('disconnected', () => {
      console.log('Ably: Disconnected');
      setIsConnected(false);
    });

    ablyClient.connection.on('failed', (error) => {
      console.error('Ably: Connection failed:', error);
      setIsConnected(false);
    });

    setAbly(ablyClient);

    return () => {
      ablyClient.connection.close();
    };
  }, []);

  // Helper function to get or create a channel
  const getChannel = (channelName) => {
    if (!ably) return null;
    
    if (!channels[channelName]) {
      const channel = ably.channels.get(channelName);
      setChannels(prev => ({ ...prev, [channelName]: channel }));
      return channel;
    }
    
    return channels[channelName];
  };

  // Helper function to join a room (channel)
  const joinRoom = (roomName, userData) => {
    const channel = getChannel(`room:${roomName}`);
    if (!channel) return;

    // Enter presence to show user is in the room
    channel.presence.enter(userData);
    
    return channel;
  };

  // Helper function to leave a room
  const leaveRoom = (roomName) => {
    const channel = channels[`room:${roomName}`];
    if (channel) {
      channel.presence.leave();
      channel.detach();
      setChannels(prev => {
        const newChannels = { ...prev };
        delete newChannels[`room:${roomName}`];
        return newChannels;
      });
    }
  };

  // Emit function to publish messages (similar to socket.emit)
  const emit = (channelName, eventName, data) => {
    const channel = getChannel(channelName);
    if (channel) {
      channel.publish(eventName, data);
    }
  };

  // Subscribe function (similar to socket.on)
  const subscribe = (channelName, eventName, callback) => {
    const channel = getChannel(channelName);
    if (channel) {
      channel.subscribe(eventName, callback);
    }
  };

  // Unsubscribe function (similar to socket.off)
  const unsubscribe = (channelName, eventName, callback) => {
    const channel = channels[channelName];
    if (channel) {
      if (callback) {
        channel.unsubscribe(eventName, callback);
      } else {
        channel.unsubscribe(eventName);
      }
    }
  };

  // Send message with server-side handling for certain events
  const sendMessage = async (eventType, data) => {
    if (!isConnected) {
      console.log('Not connected to Ably');
      return;
    }

    // Events that need server-side processing
    const serverEvents = [
      'joinRoom', 'leaveRoom', 'setRoomHost', 'endSession', 'requestUserList'
    ];

    // Check if this event needs server processing
    const needsServerProcessing = serverEvents.includes(eventType) || 
                                 eventType.startsWith('chat_') || 
                                 eventType.startsWith('timer_');

    if (needsServerProcessing) {
      try {
        // Convert event types for server processing
        let serverEventType = eventType;
        if (eventType.includes('chat_') && eventType.includes(':message')) {
          serverEventType = 'chat_message';
        } else if (eventType.includes('chat_') && eventType.includes(':requestHistory')) {
          serverEventType = 'chat_requestHistory';
        } else if (eventType.includes('timer_') && eventType.includes(':update')) {
          serverEventType = 'timer_update';
        } else if (eventType.includes('timer_') && eventType.includes(':requestState')) {
          serverEventType = 'timer_requestState';
        }

        console.log(`📡 Sending to server: ${serverEventType}`, data);

        // Send to server for processing
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}/api/ably/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventType: serverEventType,
            data: { ...data, clientId: ably?.auth?.clientId }
          })
        });
        
        if (!response.ok) {
          console.error('Server message failed:', response.statusText);
        } else {
          console.log(`✅ Server processed: ${serverEventType}`);
        }
      } catch (error) {
        console.error('Error sending server message:', error);
      }
    } else {
      // Direct channel publish for other events
      const room = data.room || 'general';
      const channel = getChannel(room);
      if (channel) {
        try {
          console.log(`📤 Publishing direct to channel ${room}:`, eventType, data);
          await channel.publish(eventType, data);
        } catch (error) {
          console.error('Error publishing message:', error);
        }
      }
    }
  };

  // onMessage function (similar to socket.on)
  const onMessage = (eventType, callback) => {
    // Extract room from event type
    let room = 'general';
    if (eventType.includes('_') && eventType.includes(':')) {
      const parts = eventType.split('_');
      if (parts.length > 1) {
        room = parts[1].split(':')[0];
      }
    } else if (eventType.includes('room_') && eventType.includes(':')) {
      const parts = eventType.split('room_');
      if (parts.length > 1) {
        room = parts[1].split(':')[0];
      }
    }

    console.log(`🔗 AblyContext: Setting up listener for ${eventType} on room: ${room}`);
    const channel = getChannel(room);
    if (channel) {
      channel.subscribe(eventType, (message) => {
        console.log(`📥 AblyContext: Received ${eventType}:`, message.data);
        callback(message.data);
      });
    }
  };

  // offMessage function (similar to socket.off)
  const offMessage = (eventType, callback) => {
    // Extract room from event type
    let room = 'general';
    if (eventType.includes('_') && eventType.includes(':')) {
      const parts = eventType.split('_');
      if (parts.length > 1) {
        room = parts[1].split(':')[0];
      }
    } else if (eventType.includes('room_') && eventType.includes(':')) {
      const parts = eventType.split('room_');
      if (parts.length > 1) {
        room = parts[1].split(':')[0];
      }
    }

    console.log(`🔗 AblyContext: Removing listener for ${eventType} from room: ${room}`);
    const channel = channels[room];
    if (channel) {
      if (callback) {
        channel.unsubscribe(eventType, callback);
      } else {
        channel.unsubscribe(eventType);
      }
    }
  };

  // Specific method for chat to avoid conflicts
  const sendAblyMessage = async (eventType, data) => {
    if (!isConnected) {
      console.log('Not connected to Ably');
      return;
    }

    console.log(`🚀 SendAblyMessage: ${eventType}`, data);
    return sendMessage(eventType, data);
  };

  const contextValue = {
    ably,
    connected: isConnected,
    channels,
    getChannel,
    connectToChannel: getChannel,
    joinRoom,
    leaveRoom,
    emit,
    sendMessage,
    sendAblyMessage,
    onMessage,
    offMessage,
    subscribe,
    unsubscribe
  };

  return (
    <AblyContext.Provider value={contextValue}>
      {children}
    </AblyContext.Provider>
  );
};

export default AblyContext;
