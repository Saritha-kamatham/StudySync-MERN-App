// server/sockets/socket.js
const jwt = require('jsonwebtoken');
const { saveMessage, getRoomMessages } = require('../controllers/messageController');
const { saveRoom, getRoom } = require('../controllers/roomController');
const Room = require('../models/Room');

// Export function that takes io and shared rooms object
module.exports = (io, socketRooms = {}) => {
  // Use the passed in rooms object or create a new one if not provided
  const rooms = socketRooms; // { roomName: { users: [{ id, name }], timer: {...}, cycles: 0, interval: null } }
  // JWT auth middleware with fallback for development
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      // For development: allow connections without token with a default user
      console.log('Warning: No auth token provided, using default user');
      socket.user = { name: 'Anonymous User', id: socket.id, isAuthenticated: false };
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-for-development');
      // Store the user data in the socket.user object, ensuring we have proper user data
      socket.user = {
        id: decoded.user?.id || socket.id,
        name: decoded.user?.name || 'Anonymous User',
        email: decoded.user?.email,
        isAuthenticated: true,
        _decoded: decoded // Keep the full decoded data for debugging
      };
      console.log('Authenticated user:', socket.user.name, socket.user.id);
      return next();
    } catch (err) {
      console.error('Token verification error:', err.message);
      // For development: allow connections with invalid token
      socket.user = { name: 'Anonymous User', id: socket.id, isAuthenticated: false };
      return next();
    }
  });

  // Utility function to log room status
  const logRoomStatus = () => {
    console.log("\n===== ROOM STATUS =====");
    Object.keys(rooms).forEach(roomName => {
      const room = rooms[roomName];
      console.log(`Room: ${roomName}`);
      console.log(`  Users: ${room.users.length}`);
      console.log(`  Users list: ${room.users.map(u => `${u.name} (${u.id})`).join(', ')}`);
      console.log(`  Host: ${room.host || 'None'}`);
    });
    console.log("=======================\n");
  };
  
  // Utility function to broadcast room changes
  const broadcastRoomChange = (roomName) => {
    // Broadcast to all connected clients that rooms have changed
    // Clients should refresh their room lists
    io.emit('roomChanged', { room: roomName });
    console.log(`Broadcasting room change for ${roomName}`);
  };

  // Log room status every 30 seconds
  const statusInterval = setInterval(logRoomStatus, 30000);

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id, 'User:', socket.user?.name);

    // Join room
    socket.on('joinRoom', async ({ room, userName, asHost }) => {
      // Fetch room from DB to check if it exists
      let dbRoom = null;
      try {
        dbRoom = await getRoom(room);
        // If room doesn't exist, deny joining
        if (!dbRoom) {
          socket.emit('joinDenied', { reason: `Room "${room}" does not exist!` });
          return;
        }
      } catch (err) {
        console.error('Error checking room:', err);
        socket.emit('joinDenied', { reason: 'Room not found or error occurred!' });
        return;
      }
      // Join the socket.io room
      socket.join(room);
      console.log(`🏠 User ${socket.user.name} (${socket.id}) joined socket room "${room}"`);
      
      // Log current room membership
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      const socketCount = socketsInRoom ? socketsInRoom.size : 0;
      console.log(`📊 Socket room "${room}" now has ${socketCount} connected sockets:`, 
        socketsInRoom ? Array.from(socketsInRoom) : []);
      
      // Initialize room if it doesn't exist
      if (!rooms[room]) {
        rooms[room] = { 
          users: [], 
          timer: { running: false, seconds: 25 * 60, label: "Custom Timer" }, 
          cycles: 0
        };
        console.log(`🆕 Initialized new room ${room} with default timer state`);
      }
      
      // Remove any previous entries for this socket or user (prevents duplicates)
      const userId = socket.user.id || socket.id;
      
      // Check if the user was already in the room
      const existingUserIndex = rooms[room].users.findIndex(u => 
        u.socketId === socket.id || 
        (socket.user.isAuthenticated && u.userId === userId)
      );
      
      if (existingUserIndex !== -1) {
        console.log(`User ${socket.user.name} (${userId}) is rejoining room ${room}. Updating entry.`);
      }
      
      // Filter out any previous entries for this user
      const beforeFilter = rooms[room].users.length;
      rooms[room].users = rooms[room].users.filter(u => 
        u.socketId !== socket.id && 
        (socket.user.isAuthenticated ? u.userId !== userId : true)
      );
      const afterFilter = rooms[room].users.length;
      
      if (beforeFilter !== afterFilter) {
        console.log(`🧹 Removed ${beforeFilter - afterFilter} duplicate entries for user ${socket.user.name}`);
      }
      
      console.log('🔍 DEBUG: User authentication details:', {
        socketUser: socket.user,
        socketUserName: socket.user?.name,
        socketUserId: socket.user?.id,
        isAuthenticated: socket.user?.isAuthenticated,
        providedUserName: userName
      });

      // Prepare user data with correct naming
      let displayName;
      
      if (socket.user.isAuthenticated && socket.user.name && socket.user.name !== 'Anonymous User') {
        // For authenticated users, ALWAYS use the server-side authenticated name
        displayName = socket.user.name;
        console.log(`✅ Using authenticated user name: ${displayName}`);
      } else {
        // For non-authenticated users, prioritize the provided userName over the default 'Anonymous User'
        displayName = userName || 'Anonymous User';
        console.log(`⚠️ Using provided name for non-authenticated user: ${displayName} (provided: ${userName})`);
      }
      
      // Add user to room with complete information
      const userInfo = { 
        id: socket.id,                            // socket ID (changes on reconnect)
        socketId: socket.id,                      // duplicate for clarity
        userId: userId,                           // persistent user ID (from auth) 
        name: displayName,                        // display name
        isAuthenticated: socket.user.isAuthenticated,
        joinedAt: new Date()
      };
      
      rooms[room].users.push(userInfo);
      
      console.log(`✅ Added user to room ${room}:`, {
        name: displayName,
        userId: userId,
        socketId: socket.id,
        isAuthenticated: socket.user.isAuthenticated
      });
      console.log(`📊 Room ${room} now has ${rooms[room].users.length} users:`, 
        rooms[room].users.map(u => `${u.name} (${u.userId || u.id})`));
      
      // Store room name in socket for disconnect handling
      socket.data.currentRoom = room;
      // Save/update room in DB (preserve privacy fields if room exists)
      try {
        // Set host based on: explicit asHost flag, existing host, or first user
        let hostId;
        
        if (asHost) {
          // If user explicitly requested to join as host
          hostId = userId;
          console.log(`User ${displayName} (${userId}) joining as explicit host of room ${room}`);
          // Store host in the room's memory state too
          rooms[room].host = userId;
        } else if (dbRoom?.host) {
          // Keep existing host if available
          hostId = dbRoom.host;
          rooms[room].host = dbRoom.host;
        } else if (rooms[room].users.length === 1) {
          // First user becomes host by default
          hostId = userId;
          rooms[room].host = userId;
          console.log(`User ${displayName} (${userId}) is first user, becoming host of room ${room}`);
        } else {
          // Fall back to first user in the room
          hostId = rooms[room].users[0]?.userId || rooms[room].users[0]?.id;
          rooms[room].host = hostId;
        }
        
        await saveRoom({
          name: room,
          host: hostId,
          users: rooms[room].users,
          isPublic: dbRoom.isPublic, // Preserve existing privacy setting
          password: dbRoom.password   // Preserve existing password
        });
      } catch (err) {
        console.error('Error saving room:', err);
      }
      // Debug: log the user list
      console.log(`Room '${room}' users:`, rooms[room].users);
      
      // Update the room list for this room
      if (rooms[room] && rooms[room].users) {
        // Get the room host information from the database
        const dbRoomUpdated = await getRoom(room);
        if (dbRoomUpdated) {
          // Check if the current user should be host
          const currentUserIsHost = dbRoomUpdated.host === userId;
          if (currentUserIsHost) {
            console.log(`User ${displayName} (${userId}) confirmed as host for room ${room}`);
          }
          
          // Emit host status to the joining user
          socket.emit('hostStatus', { isHost: currentUserIsHost });
        }
      }
      
      // Broadcast updated user list to all clients in the room
      console.log(`📢 Broadcasting user list to all clients in room "${room}":`, rooms[room].users.map(u => u.name));
      io.to(room).emit('roomUsers', rooms[room].users);
      // Also send the user list directly to the joining socket
      socket.emit('roomUsers', rooms[room].users);
      
      // Send current timer state to the joining user
      console.log(`📤 Sending current timer state to ${socket.user.name}:`, rooms[room].timer);
      socket.emit('timer:update', rooms[room].timer);
      
      // Broadcast room change to all clients so they can refresh room lists
      broadcastRoomChange(room);
      
      // Log room status after join
      logRoomStatus();
      // Fetch and send message history
      try {
        const messages = await getRoomMessages(room);
        console.log(`Sending ${messages.length} chat messages to user ${socket.user.name} in room ${room}`);
        socket.emit('chat:history', messages);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    });

    // Leave room
    socket.on('leaveRoom', async ({ room }) => {
      console.log(`User ${socket.user?.name} (${socket.id}) leaving room ${room}`);
      
      // Leave the socket.io room
      socket.leave(room);
      
      // Get the user's ID for authenticated users
      const userId = socket.user?.id || socket.id;
      const userName = socket.user?.name || 'Anonymous';
      
      console.log(`Removing user ${userName} (${userId}) from room ${room}`);
      
      // Clean up user data from the room
      if (rooms[room]) {
        // Remove the user from the room's user list (check all possible identifiers)
        const beforeCount = rooms[room].users.length;
        rooms[room].users = rooms[room].users.filter(u => 
          u.id !== socket.id && 
          u.socketId !== socket.id && 
          (socket.user?.isAuthenticated ? u.userId !== userId : true)
        );
        const afterCount = rooms[room].users.length;
        
        console.log(`Room ${room}: User count changed from ${beforeCount} to ${afterCount}`);
        
        // Get remaining sockets in the room to verify if anyone is still connected
        const socketsInRoom = io.sockets.adapter.rooms.get(room);
        const activeSocketCount = socketsInRoom ? socketsInRoom.size : 0;
        
        console.log(`Room ${room}: Socket.IO shows ${activeSocketCount} connected sockets`);
        
        // Double-check if the room is actually empty (users array vs actual sockets)
        if (activeSocketCount === 0 || rooms[room].users.length === 0) {
          console.log(`Room ${room} is empty (users: ${rooms[room].users.length}, sockets: ${activeSocketCount}), cleaning up in-memory state`);
          
          // Clean up any timers
          if (rooms[room].interval) {
            clearInterval(rooms[room].interval);
          }
          
          // Set users array to empty to be sure
          if (rooms[room]) {
            rooms[room].users = [];
          }
          
          // Remove the in-memory room data
          delete rooms[room];
          
          // Log the current rooms state after deletion
          console.log("Rooms after cleanup:", Object.keys(rooms));
        } else {
          // Room still has users, update the list for remaining users
          console.log(`📢 Broadcasting updated user list after leave to room "${room}":`, rooms[room].users.map(u => u.name));
          io.to(room).emit('roomUsers', rooms[room].users);
          
          // Broadcast room change to all clients so they can refresh room lists
          broadcastRoomChange(room);
        }
        
        // Update the database to reflect the current user list
        try {
          const dbRoom = await getRoom(room);
          if (dbRoom) {
            // Get the actual sockets currently in the room
            const socketsInRoom = io.sockets.adapter.rooms.get(room);
            const actualSocketIds = socketsInRoom ? Array.from(socketsInRoom) : [];
            
            // If we have in-memory user data, update it based on actually connected sockets
            if (rooms[room] && rooms[room].users) {
              // Filter users to only those whose sockets are still in the room
              const beforeFilter = rooms[room].users.length;
              rooms[room].users = rooms[room].users.filter(user => 
                actualSocketIds.includes(user.socketId)
              );
              const afterFilter = rooms[room].users.length;
              
              if (beforeFilter !== afterFilter) {
                console.log(`Room ${room}: Filtered out ${beforeFilter - afterFilter} users who are not actually connected`);
              }
            }
            
            // Whether room exists in memory or not, update the database with latest user list
            // If room was deleted from memory, set users to empty array
            const updatedUsers = (rooms[room] && rooms[room].users) ? rooms[room].users : [];
            
            // Always update lastActive timestamp
            await saveRoom({
              ...dbRoom,
              users: updatedUsers,
              lastActive: new Date()
            });
            
            console.log(`Updated room ${room} in database. Active users: ${updatedUsers.length}`);
          }
        } catch (err) {
          console.error(`Error updating room ${room} after user left:`, err);
        }
      }
      
      // Clear the current room from socket data
      if (socket.data.currentRoom === room) {
        socket.data.currentRoom = null;
      }
      
      // Always broadcast room change to update room list everywhere
      broadcastRoomChange(room);
      
      // Log room status after leave
      logRoomStatus();
    });

    // Handle setting a user as host
    socket.on('setRoomHost', async ({ room, userId }) => {
      if (!room || !userId) return;
      
      try {
        const dbRoom = await getRoom(room);
        if (dbRoom) {
          await saveRoom({
            ...dbRoom,
            host: userId
          });
          console.log(`Set user ${userId} as host of room ${room}`);
        }
      } catch (err) {
        console.error('Error setting room host:', err);
      }
    });
    
    // Handle request for chat history
    socket.on('requestChatHistory', async ({ room }) => {
      if (!room) return;
      
      try {
        console.log(`[Server] Chat history requested by ${socket.user.name} for room ${room}`);
        const messages = await getRoomMessages(room);
        console.log(`[Server] Sending ${messages.length} messages of chat history to ${socket.user.name}`);
        socket.emit('chat:history', messages);
      } catch (err) {
        console.error(`Error fetching chat history for room ${room}:`, err);
        socket.emit('chat:history', []);
      }
    });

    // Handle room deletion notification
    socket.on('roomDeleted', async ({ room }) => {
      if (!room) return;
      
      // Get host name for better notification
      const hostName = socket.user?.name || "The host";
      
      // Notify all users in the room that it has been deleted
      io.to(room).emit('roomClosed', { 
        reason: `Room has been deleted by ${hostName}`,
        hostId: socket.user?.id || socket.id,
        roomName: room
      });
      
      console.log(`Room ${room} deleted by ${hostName} (${socket.user?.id || socket.id})`);
      
      // Clean up the room data
      if (rooms[room]) {
        delete rooms[room];
      }
      
      try {
        // Make sure the messages for this room are deleted as well
        // This ensures all clients trigger message deletion
        const Message = require('../models/Message');
        await Message.deleteMany({ room: room });
        console.log(`Messages for room ${room} have been deleted`);
      } catch (err) {
        console.error(`Error deleting messages for room ${room}:`, err);
      }
    });
    
    // Handle request for current user list
    socket.on('requestUserList', ({ room }) => {
      if (!room) return;
      
      console.log(`📋 User ${socket.user.name} requested user list for room ${room}`);
      console.log(`📊 Room ${room} current users:`, rooms[room]?.users?.map(u => u.name) || 'No users');
      
      if (rooms[room] && rooms[room].users) {
        console.log(`📤 Sending user list to ${socket.user.name}:`, rooms[room].users);
        socket.emit('roomUsers', rooms[room].users);
      } else {
        console.log(`⚠️ Room ${room} not found or has no users, sending empty list`);
        socket.emit('roomUsers', []);
      }
    });
    
    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id} (${socket.user?.name})`);
      
      // Get the user's ID for authenticated users (to properly remove them)
      const userId = socket.user?.id || socket.id;
      const userName = socket.user?.name || 'Unknown User';
      
      // Get all socket rooms the user was in
      const userRooms = [...socket.rooms].filter(r => r !== socket.id);
      const currentRoom = socket.data.currentRoom;
      
      console.log(`User ${userName} (${userId}) was in room: ${currentRoom || 'none'}`);
      
      // Update user lists in all rooms
      for (const roomName in rooms) {
        // Check if user was in this room (check by socket ID and user ID if authenticated)
        const userInRoom = rooms[roomName]?.users?.some(u => 
          u.id === socket.id || 
          u.socketId === socket.id || 
          (socket.user?.isAuthenticated && u.userId === userId)
        );
        
        if (userInRoom) {
          console.log(`Removing user ${userName} (${userId}) from room: ${roomName}`);
          
          // Remove user from the room's user list (check all identifiers)
          const beforeCount = rooms[roomName].users.length;
          rooms[roomName].users = rooms[roomName].users.filter(u => 
            u.id !== socket.id && 
            u.socketId !== socket.id &&
            (socket.user?.isAuthenticated ? u.userId !== userId : true)
          );
          const afterCount = rooms[roomName].users.length;
          
          console.log(`👋 Room ${roomName}: User count changed from ${beforeCount} to ${afterCount}`);
          console.log(`📤 Broadcasting updated user list after disconnect:`, rooms[roomName].users.map(u => u.name));
          
          // Check if there are any actual sockets still in the room
          const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
          const actualSocketCount = socketsInRoom ? socketsInRoom.size : 0;
          
          // If room is empty after user leaves, clean it up completely
          if (rooms[roomName].users.length === 0 || actualSocketCount === 0) {
            console.log(`Room ${roomName} is empty (users: ${rooms[roomName].users.length}, sockets: ${actualSocketCount}) after disconnect, cleaning up in-memory state`);
            
            // Clean up any timers
            if (rooms[roomName].interval) {
              clearInterval(rooms[roomName].interval);
            }
            
            // Clear users array for database update
            rooms[roomName].users = [];
            
            // Remove the in-memory room data
            delete rooms[roomName]; 
            
            // Update database to show room has no active users
            try {
              const dbRoom = await getRoom(roomName);
              if (dbRoom) {
                await saveRoom({
                  ...dbRoom,
                  users: [],
                  lastActive: new Date()
                });
              }
            } catch (err) {
              console.error(`Error updating empty room ${roomName} after disconnect:`, err);
            }
          } else {
            // Emit updated user list to remaining users
            io.to(roomName).emit('roomUsers', rooms[roomName].users);
            
            // Update the database to reflect the current user list
            try {
              const dbRoom = await getRoom(roomName);
              if (dbRoom) {
                // Get the actual sockets currently in the room
                const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
                const actualSocketIds = socketsInRoom ? Array.from(socketsInRoom) : [];
                
                // Filter out users whose sockets are no longer connected
                if (rooms[roomName] && rooms[roomName].users) {
                  const beforeFilter = rooms[roomName].users.length;
                  rooms[roomName].users = rooms[roomName].users.filter(user => 
                    actualSocketIds.includes(user.socketId)
                  );
                  const afterFilter = rooms[roomName].users.length;
                  
                  if (beforeFilter !== afterFilter) {
                    console.log(`Room ${roomName}: Filtered out ${beforeFilter - afterFilter} users who are not actually connected`);
                  }
                }
                
                await saveRoom({
                  ...dbRoom, 
                  users: rooms[roomName].users,
                  lastActive: new Date()
                });
              }
            } catch (err) {
              console.error(`Error updating room ${roomName} after disconnect:`, err);
            }
          }
          
          // Always broadcast room change after a disconnect
          broadcastRoomChange(roomName);
        }
      }
      
      // Leave all socket.io rooms
      userRooms.forEach(room => socket.leave(room));
      
      // Log room status after disconnect
      logRoomStatus();
    });

    // Timer events
    socket.on("timer:start", ({ room, timer }) => {
      console.log(`[Server] timer:start received for room ${room}`, timer);
      if (rooms[room]) {
        // Clear any existing interval
        if (rooms[room].interval) {
          clearInterval(rooms[room].interval);
          rooms[room].interval = null;
        }
        rooms[room].timer = { ...timer, running: true };
        console.log(`[Server] Broadcasting timer:update to room ${room}:`, rooms[room].timer);
        io.to(room).emit("timer:update", rooms[room].timer);
      }
    });

    socket.on("timer:pause", ({ room }) => {
      console.log(`[Server] timer:pause received for room ${room}`);
      if (rooms[room] && rooms[room].timer) {
        rooms[room].timer.running = false;
        console.log(`[Server] Broadcasting timer:update (paused) to room ${room}:`, rooms[room].timer);
        io.to(room).emit("timer:update", rooms[room].timer);
        if (rooms[room].interval) {
          clearInterval(rooms[room].interval);
          rooms[room].interval = null;
        }
      }
    });

    socket.on("timer:tick", ({ room, seconds }) => {
      console.log(`[Server] timer:tick received for room ${room}, seconds: ${seconds}`);
      if (rooms[room] && rooms[room].timer && rooms[room].timer.running) {
        rooms[room].timer.seconds = seconds;
        console.log(`[Server] Broadcasting timer:update to room ${room}:`, rooms[room].timer);
        io.to(room).emit("timer:update", rooms[room].timer);
        
        // Check if timer finished
        if (seconds <= 0) {
          rooms[room].timer.running = false;
          console.log(`[Server] Timer finished for room ${room}, broadcasting final state`);
          io.to(room).emit("timer:update", rooms[room].timer);
        }
      }
    });

    socket.on("timer:reset", ({ room, timer }) => {
      console.log(`[Server] timer:reset received for room ${room}`, timer);
      if (rooms[room]) {
        rooms[room].timer = { ...timer, running: false };
        console.log(`[Server] Broadcasting timer:update (reset) to room ${room}:`, rooms[room].timer);
        io.to(room).emit("timer:update", rooms[room].timer);
        if (rooms[room].interval) {
          clearInterval(rooms[room].interval);
          rooms[room].interval = null;
        }
      }
    });

    // Handle request for current timer state
    socket.on("requestTimerState", ({ room }) => {
      console.log(`[Server] Timer state requested by ${socket.user.name} for room ${room}`);
      if (rooms[room] && rooms[room].timer) {
        console.log(`[Server] Sending current timer state to ${socket.user.name}:`, rooms[room].timer);
        socket.emit("timer:update", rooms[room].timer);
      } else {
        console.log(`[Server] No timer state found for room ${room}, sending default`);
        socket.emit("timer:update", { running: false, seconds: 25 * 60, label: "Custom Timer" });
      }
    });

    // Chat message
    socket.on("chat:message", async ({ room, message }) => {
      // Priority: Use authenticated user name first, fallback to provided name
      let userName;
      let userId;
      let isAuthenticated = socket.user.isAuthenticated;
      
      // If user is authenticated via JWT, always use their JWT name
      if (socket.user.isAuthenticated) {
        userName = socket.user.name;
        userId = socket.user.id;
      } 
      // If client sent authentication info in the message
      else if (message.isAuthenticated && message.userId) {
        userName = message.user;
        userId = message.userId;
        isAuthenticated = true;
      }
      // If not authenticated, use the provided name from the client
      else if (message.user && message.user !== 'Anonymous User') {
        userName = message.user;
        userId = socket.id;
      } 
      // Last resort fallback
      else {
        userName = message.user || socket.user.name;
        userId = socket.id;
      }
      
      const msgObj = { 
        ...message, 
        user: userName,
        userId: userId,
        isAuthenticated: isAuthenticated,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[Server] Message from ${userName} (${userId}) in room ${room}:`, message.text.substring(0, 20));
      
      // Debug: Check who's in the socket room
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      const socketCount = socketsInRoom ? socketsInRoom.size : 0;
      console.log(`📤 Broadcasting message to ${socketCount} sockets in room "${room}":`, 
        socketsInRoom ? Array.from(socketsInRoom) : []);
      
      // Send to all clients in the room including sender for immediate feedback
      io.to(room).emit("chat:message", msgObj);
      
      // Save to DB
      try {
        await saveMessage({ 
          room, 
          user: userName, 
          userId: userId,
          text: message.text,
          isAuthenticated: isAuthenticated
        });
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });
    
    // Handle "End Session" event from host
    socket.on('endSession', async ({ room }) => {
      console.log(`\n🚨 ==================== END SESSION REQUEST ====================`);
      console.log(`[Server] endSession received for room ${room}`);
      console.log(`🔍 Request from socket: ${socket.id}`);
      console.log(`🔍 Request from user: ${socket.user?.name} (${socket.user?.id})`);
      console.log(`🔍 Socket user object:`, socket.user);
      
      if (!room) {
        console.error('❌ No room name provided for endSession');
        console.log(`🚨 ==================== END SESSION FAILED ====================\n`);
        return;
      }
      
      try {
        // Check if user is the host of the room (from DB)
        console.log(`\n🔍 STEP 1: Looking up room ${room} in database...`);
        const dbRoom = await getRoom(room);
        const userId = socket.user.id || socket.user._id || socket.user.email;
        
        console.log(`🔍 STEP 2: Database room lookup result:`, {
          roomExists: !!dbRoom,
          roomHost: dbRoom?.host,
          requestingUserId: userId,
          roomData: dbRoom ? {
            name: dbRoom.name,
            host: dbRoom.host,
            users: dbRoom.users,
            isPublic: dbRoom.isPublic,
            createdAt: dbRoom.createdAt
          } : null
        });
        
        if (!dbRoom) {
          console.warn(`⚠️ STEP 2 FAILED: Room ${room} not found in database - it may have already been deleted`);
          // Still broadcast room change in case it exists in memory
          broadcastRoomChange(room);
          console.log(`🚨 ==================== END SESSION ABORTED ====================\n`);
          return;
        }
        
        // Make sure this request is coming from the room host
        const isHost = dbRoom.host === userId;
        console.log(`\n🔍 STEP 3: Host verification:`, {
          dbRoomHost: dbRoom.host,
          dbRoomHostType: typeof dbRoom.host,
          requestingUserId: userId,
          requestingUserIdType: typeof userId,
          isHost: isHost,
          exactMatch: dbRoom.host === userId,
          looseMatch: String(dbRoom.host) === String(userId)
        });
        
        if (!isHost) {
          console.log(`❌ STEP 3 FAILED: User ${userId} attempted to end session for room ${room} but is not the host (actual host: ${dbRoom.host})`);
          console.log(`❌ Host verification failed - sending error to client`);
          socket.emit('error', { message: 'Only the room host can end the session' });
          console.log(`🚨 ==================== END SESSION DENIED ====================\n`);
          return;
        }
        
        console.log(`\n✅ STEP 3 PASSED: User ${userId} is verified host of room ${room} - proceeding with deletion`);
        console.log(`🔍 STEP 4: Starting session termination process...`);
        
        // Get host name for better notification
        const hostName = socket.user?.name || "The host";
        
        // Notify all users in the room that the session has ended with host information
        console.log(`📢 STEP 4A: Notifying all users in room ${room}...`);
        io.to(room).emit('roomClosed', { 
          reason: `${hostName} has ended this study session`,
          hostId: userId,
          roomName: room
        });
        
        console.log(`📢 STEP 4A COMPLETED: Notified all users in room ${room} that session ended`);
        
        // Clean up the in-memory room data
        console.log(`🧹 STEP 4B: Cleaning up in-memory data for room ${room}...`);
        if (rooms[room]) {
          console.log(`🧹 Room ${room} found in memory - cleaning up...`);
          // Clear any running timers
          if (rooms[room].interval) {
            clearInterval(rooms[room].interval);
            console.log(`⏰ Cleared timer for room ${room}`);
          }
          // Clear user list
          const userCount = rooms[room].users ? rooms[room].users.length : 0;
          rooms[room].users = [];
          // Remove from memory
          delete rooms[room];
          console.log(`✅ STEP 4B COMPLETED: Removed room ${room} from memory (had ${userCount} users)`);
        } else {
          console.log(`ℹ️ STEP 4B SKIPPED: Room ${room} was not found in memory`);
        }
        
        // Remove the room from the database (using deleteOne for complete removal)
        console.log(`\n🗄️ STEP 5: Database deletion process starting...`);
        console.log(`🗄️ STEP 5A: Attempting to delete room ${room} from database...`);
        
        const deleteResult = await Room.deleteOne({ name: room });
        console.log(`🗄️ STEP 5A RESULT: Room deletion result:`, {
          acknowledged: deleteResult.acknowledged,
          deletedCount: deleteResult.deletedCount,
          matchedCount: deleteResult.matchedCount || 'N/A'
        });
        
        if (deleteResult.deletedCount === 0) {
          console.warn(`⚠️ STEP 5A WARNING: Room ${room} was not found in database for deletion - it may have already been deleted`);
          console.warn(`⚠️ This could indicate a race condition or the room was deleted by another process`);
        } else {
          console.log(`✅ STEP 5A SUCCESS: Room ${room} successfully deleted from database`);
        }
        
        // Also delete all messages associated with this room
        const Message = require('../models/Message');
        console.log(`🗄️ STEP 5B: Deleting messages for room ${room}...`);
        const messageDeleteResult = await Message.deleteMany({ room: room });
        console.log(`🗄️ STEP 5B RESULT: Message deletion result:`, {
          acknowledged: messageDeleteResult.acknowledged,
          deletedCount: messageDeleteResult.deletedCount
        });
        console.log(`✅ STEP 5B COMPLETED: Deleted ${messageDeleteResult.deletedCount} messages for room ${room}`);
        
        console.log(`\n🎉 STEP 6: Room ${room} and its messages successfully ended and deleted`);
        
        // Final verification - check if room was actually deleted
        console.log(`🔍 STEP 7: Final verification - checking if room was actually deleted...`);
        setTimeout(async () => {
          try {
            const verifyRoom = await getRoom(room);
            if (verifyRoom) {
              console.error(`🚨 STEP 7 CRITICAL ERROR: Room ${room} still exists in database after deletion attempt!`);
              console.error(`🚨 Room data found:`, verifyRoom);
              console.error(`🚨 This indicates a serious database issue - attempting second deletion...`);
              // Try deleting again
              const secondDeleteAttempt = await Room.deleteOne({ name: room });
              console.log(`🔄 Second deletion attempt result:`, secondDeleteAttempt);
              if (secondDeleteAttempt.deletedCount > 0) {
                console.log(`✅ Second deletion attempt successful`);
              } else {
                console.error(`❌ Second deletion attempt also failed - database may have constraints or errors`);
              }
            } else {
              console.log(`✅ STEP 7 SUCCESS: VERIFIED that room ${room} was successfully deleted from database`);
            }
          } catch (verifyErr) {
            console.error(`❌ STEP 7 ERROR: Error verifying room deletion:`, verifyErr);
          }
        }, 500); // Check after 500ms
        
        // Give clients a moment to receive the notification before disconnecting
        console.log(`\n🔌 STEP 8: Socket cleanup and broadcasting...`);
        setTimeout(() => {
          // Force disconnect all sockets in the room
          const socketsInRoom = io.sockets.adapter.rooms.get(room);
          if (socketsInRoom) {
            console.log(`🔌 STEP 8A: Disconnecting ${socketsInRoom.size} sockets from room ${room}`);
            let disconnectedCount = 0;
            for (const socketId of socketsInRoom) {
              const socketToDisconnect = io.sockets.sockets.get(socketId);
              if (socketToDisconnect) {
                socketToDisconnect.leave(room);
                disconnectedCount++;
              }
            }
            console.log(`✅ STEP 8A COMPLETED: Successfully disconnected ${disconnectedCount} sockets from room ${room}`);
          } else {
            console.log(`ℹ️ STEP 8A SKIPPED: No sockets found in room ${room} to disconnect`);
          }
          
          // Broadcast room change to all clients after cleanup
          console.log(`📢 STEP 8B: Broadcasting room change for deleted room: ${room}`);
          broadcastRoomChange(room);
          console.log(`✅ STEP 8B COMPLETED: Room change broadcasted`);
          
          console.log(`🎉 ==================== END SESSION COMPLETED ====================\n`);
        }, 1000); // 1 second delay to ensure notifications are received
        
      } catch (err) {
        console.error(`\n❌ ==================== END SESSION ERROR ====================`);
        console.error(`❌ Error ending session for room ${room}:`, err.message);
        console.error(`❌ Error stack:`, err.stack);
        console.error(`❌ This error occurred during the endSession process`);
        
        // Still try to broadcast room change in case of partial failure
        console.log(`🔄 Attempting to broadcast room change despite error...`);
        try {
          broadcastRoomChange(room);
          console.log(`✅ Emergency room change broadcast completed`);
        } catch (broadcastErr) {
          console.error(`❌ Even emergency broadcast failed:`, broadcastErr);
        }
        console.error(`❌ ==================== END SESSION ERROR ====================\n`);
      }
    });
  });
};
