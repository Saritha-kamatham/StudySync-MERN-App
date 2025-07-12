const jwt = require('jsonwebtoken');
const { saveMessage, getRoomMessages } = require('../controllers/messageController');
const { saveRoom, getRoom } = require('../controllers/roomController');
const Room = require('../models/Room');

module.exports = (io, socketRooms = {}) => {
  const rooms = socketRooms;
  
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      socket.user = { name: 'Anonymous User', id: socket.id, isAuthenticated: false };
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-for-development');
      socket.user = {
        id: decoded.user?.id || socket.id,
        name: decoded.user?.name || 'Anonymous User',
        email: decoded.user?.email,
        isAuthenticated: true,
        _decoded: decoded
      };
      return next();
    } catch (err) {
      socket.user = { name: 'Anonymous User', id: socket.id, isAuthenticated: false };
      return next();
    }
  });

  const broadcastRoomChange = (roomName) => {
    io.emit('roomListUpdate', { roomName });
  };

  io.on('connection', (socket) => {
    socket.on('joinRoom', async ({ room, userName, asHost = false }) => {
      if (!room) return;

      socket.join(room);

      if (!rooms[room]) {
        rooms[room] = {
          users: [],
          host: null,
          timer: { running: false, seconds: 25 * 60, label: "Custom Timer" },
          cycles: 0,
          interval: null
        };
      }

      let displayName;
      
      if (socket.user.isAuthenticated && socket.user.name && socket.user.name !== 'Anonymous User') {
        displayName = socket.user.name;
      } else {
        displayName = userName || 'Anonymous User';
      }
      
      const userInfo = { 
        id: socket.id,
        socketId: socket.id,
        userId: socket.user?.id,
        name: displayName,
        isAuthenticated: socket.user?.isAuthenticated || false,
        joinedAt: new Date()
      };

      const existingUserIndex = rooms[room].users.findIndex(u => 
        u.socketId === socket.id || 
        (socket.user?.isAuthenticated && u.userId === socket.user.id)
      );

      if (existingUserIndex !== -1) {
        rooms[room].users[existingUserIndex] = userInfo;
      } else {
        rooms[room].users.push(userInfo);
      }

      if (!rooms[room].host || asHost) {
        rooms[room].host = socket.user?.id || socket.id;
        socket.emit('hostStatus', { isHost: true });
      } else {
        socket.emit('hostStatus', { isHost: false });
      }

      io.to(room).emit('roomUsers', rooms[room].users);
      
      socket.emit('timer:update', rooms[room].timer);

      try {
        await saveRoom({
          name: room,
          host: rooms[room].host,
          users: rooms[room].users,
          isPublic: true
        });
      } catch (err) {
        console.error('Error saving room:', err);
      }

      broadcastRoomChange(room);
    });

    socket.on('requestChatHistory', async ({ room }) => {
      if (!room) return;
      
      try {
        const messages = await getRoomMessages(room);
        socket.emit('chat:history', messages);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    });

    socket.on('leaveRoom', async ({ room }) => {
      if (!rooms[room]) return;
      
      socket.leave(room);
      
      const userId = socket.user?.id || socket.id;
      
      if (rooms[room]) {
        const beforeCount = rooms[room].users.length;
        rooms[room].users = rooms[room].users.filter(u => 
          u.id !== socket.id && 
          u.socketId !== socket.id && 
          (socket.user?.isAuthenticated ? u.userId !== userId : true)
        );
        const afterCount = rooms[room].users.length;
        
        const socketsInRoom = io.sockets.adapter.rooms.get(room);
        const activeSocketCount = socketsInRoom ? socketsInRoom.size : 0;
        
        if (activeSocketCount === 0 || rooms[room].users.length === 0) {
          if (rooms[room].interval) {
            clearInterval(rooms[room].interval);
          }
          
          if (rooms[room]) {
            rooms[room].users = [];
          }
          
          delete rooms[room];
        } else {
          io.to(room).emit('roomUsers', rooms[room].users);
          broadcastRoomChange(room);
        }
        
        try {
          const dbRoom = await getRoom(room);
          if (dbRoom) {
            const actualSockets = io.sockets.adapter.rooms.get(room);
            const realSocketCount = actualSockets ? actualSockets.size : 0;
            
            if (realSocketCount === 0) {
              await saveRoom({
                ...dbRoom,
                users: [],
                lastActive: new Date()
              });
            } else {
              await saveRoom({
                ...dbRoom,
                users: rooms[room] ? rooms[room].users : [],
                lastActive: new Date()
              });
            }
          }
        } catch (err) {
          console.error('Error updating room after leave:', err);
        }
      }
    });

    socket.on('chat:message', async (messageData) => {
      const { room, text, user, userId, isAuthenticated } = messageData;
      
      if (!room || !text || !user) return;
      
      try {
        const savedMessage = await saveMessage({
          room,
          text,
          user,
          userId,
          isAuthenticated: isAuthenticated || false
        });
        
        io.to(room).emit('chat:message', savedMessage);
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });

    socket.on('timer:update', ({ room, timer }) => {
      if (!rooms[room]) return;
      
      rooms[room].timer = timer;
      io.to(room).emit('timer:update', timer);
    });

    socket.on('requestTimerState', ({ room }) => {
      if (rooms[room]) {
        socket.emit('timer:update', rooms[room].timer);
      }
    });

    socket.on('endSession', async ({ room }) => {
      if (!rooms[room]) return;
      
      try {
        const userId = socket.user?.id || socket.id;
        const hostName = socket.user?.name || "The host";
        
        io.to(room).emit('roomClosed', { 
          reason: `${hostName} has ended this study session`,
          hostId: userId,
          roomName: room
        });
        
        if (rooms[room]) {
          if (rooms[room].interval) {
            clearInterval(rooms[room].interval);
          }
          const userCount = rooms[room].users ? rooms[room].users.length : 0;
          rooms[room].users = [];
          delete rooms[room];
        }
        
        const deleteResult = await Room.deleteOne({ name: room });
        
        if (deleteResult.deletedCount === 0) {
          console.warn(`Room ${room} was not found in database for deletion`);
        }
        
        const Message = require('../models/Message');
        const messageDeleteResult = await Message.deleteMany({ room: room });
        
        setTimeout(() => {
          const socketsInRoom = io.sockets.adapter.rooms.get(room);
          if (socketsInRoom) {
            let disconnectedCount = 0;
            for (const socketId of socketsInRoom) {
              const socketToDisconnect = io.sockets.sockets.get(socketId);
              if (socketToDisconnect) {
                socketToDisconnect.leave(room);
                disconnectedCount++;
              }
            }
          }
          
          broadcastRoomChange(room);
        }, 1000);
        
      } catch (err) {
        console.error(`Error ending session for room ${room}:`, err.message);
      }
    });

    socket.on('disconnect', async () => {
      for (const roomName in rooms) {
        const room = rooms[roomName];
        const userIndex = room.users.findIndex(u => 
          u.socketId === socket.id || u.id === socket.id
        );
        
        if (userIndex !== -1) {
          room.users.splice(userIndex, 1);
          
          const actualSockets = io.sockets.adapter.rooms.get(roomName);
          const actualSocketCount = actualSockets ? actualSockets.size : 0;
          
          if (actualSocketCount === 0 || rooms[roomName].users.length === 0) {
            if (rooms[roomName].interval) {
              clearInterval(rooms[roomName].interval);
            }
            
            rooms[roomName].users = [];
            delete rooms[roomName];
            
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
            io.to(roomName).emit('roomUsers', rooms[roomName].users);
            broadcastRoomChange(roomName);
          }
          
          break;
        }
      }
    });
  });
};
