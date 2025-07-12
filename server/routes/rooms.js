const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const jwt = require('jsonwebtoken');

// Middleware to check JWT
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// GET /api/rooms - get all rooms
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id || req.user.email;
    
    // Get all public rooms
    const rooms = await Room.find({});
    
    // Get socket.io instance from app to access active users
    const io = req.app.get('io');
    const socketRooms = io ? req.app.get('socketRooms') : {};
    
    // Debug all in-memory rooms
    console.log("\n===== ACTIVE ROOM CHECK =====");
    Object.keys(socketRooms || {}).forEach(roomName => {
      const roomUsers = socketRooms[roomName]?.users || [];
      console.log(`Memory: Room ${roomName} has ${roomUsers.length} active users`);
    });
    
    // Enhance room data with active users count and names
    const enhancedRooms = rooms.map(room => {
      const roomData = room.toObject();
      const activeRoom = socketRooms && socketRooms[room.name];
      
      // Get all connected socket IDs for verification
      const connectedSocketIds = Array.from(io.sockets.sockets.keys());
      
      // Function to check if a user is actually connected
      const isUserConnected = (user) => {
        if (!user) return false;
        
        // Check if the socket is still connected
        const socketConnected = user.socketId && connectedSocketIds.includes(user.socketId);
        
        if (socketConnected) {
          // Double-verify the socket is in the actual room
          const socket = io.sockets.sockets.get(user.socketId);
          if (socket && socket.rooms && socket.rooms.has(room.name)) {
            return true;
          }
        }
        
        // For authenticated users, check all sockets to find if they're connected with another socket
        if (user.userId && user.isAuthenticated) {
          // Get specific room sockets
          const socketsInRoom = io.sockets.adapter.rooms.get(room.name);
          if (socketsInRoom) {
            for (const socketId of socketsInRoom) {
              const socket = io.sockets.sockets.get(socketId);
              if (socket && socket.user && socket.user.id === user.userId) {
                return true;
              }
            }
          }
        }
        
        // If we got here, the user is not connected
        return false;
      };
      
      // Handle active users based on socket.io's in-memory tracking
      if (activeRoom && Array.isArray(activeRoom.users)) {
        // Check each user to verify they are actually connected
        const actualUsers = activeRoom.users.filter(isUserConnected);
        
        if (actualUsers.length > 0) {
          roomData.activeUsers = actualUsers;
          roomData.activeCount = actualUsers.length;
        } else {
          roomData.activeUsers = [];
          roomData.activeCount = 0;
          
          // If there are no actual users but we thought there were, fix the in-memory data
          if (activeRoom.users.length > 0) {
            console.log(`Room ${room.name} had zombie users. Cleaning up in-memory state.`);
            socketRooms[room.name].users = [];
            
            // If the room is completely empty, remove it from memory
            if (socketRooms[room.name].users.length === 0) {
              console.log(`Room ${room.name} is now empty, removing from in-memory state.`);
              delete socketRooms[room.name];
            }
          }
        }
      } else {
        // No active users in this room
        roomData.activeUsers = [];
        roomData.activeCount = 0;
      }
      
      // Log active users for debugging
      console.log(`API: Room ${room.name} returning ${roomData.activeCount} active users:`, 
                 (roomData.activeUsers && roomData.activeUsers.length > 0) 
                   ? roomData.activeUsers.map(u => u.name || 'unnamed').join(', ') 
                   : 'none');
      
      return roomData;
    });
    
    // Filter out rooms with no active users (optional - you can comment this out if you want to show all rooms)
    // const activeRooms = enhancedRooms.filter(room => room.activeCount > 0 || room.host === userId);
    
    // Filter out rooms that have been inactive for too long (optional)
    // const activeRooms = enhancedRooms.filter(room => {
    //   const lastActive = new Date(room.lastActive || room.createdAt);
    //   const hoursSinceActive = (new Date() - lastActive) / (1000 * 60 * 60);
    //   return hoursSinceActive < 24; // Show rooms active in the last 24 hours
    // });
    
    // Make sure any rooms that appear in the list have empty activeUsers if they're inactive
    const cleanedRooms = enhancedRooms.map(room => {
      // If active users is inconsistent with the count, fix it
      if ((room.activeUsers && room.activeUsers.length !== room.activeCount) || 
          (!room.activeUsers && room.activeCount > 0)) {
        console.log(`Fixing inconsistent active user data for room ${room.name}`);
        room.activeCount = room.activeUsers ? room.activeUsers.length : 0;
      }
      return room;
    });
    
    res.json({ rooms: cleanedRooms });
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms - create a room
router.post('/', auth, async (req, res) => {
  const { name, isPublic = true, password } = req.body;
  if (!name) return res.status(400).json({ message: 'Room name required' });
  
  // Validate password for private rooms
  if (!isPublic && !password) {
    return res.status(400).json({ message: 'Password required for private rooms' });
  }
  
  try {
    const exists = await Room.findOne({ name });
    if (exists) return res.status(409).json({ message: 'Room name already exists' });
    
    const room = new Room({
      name,
      isPublic,
      password: isPublic ? null : password, // Only store password for private rooms
      host: req.user.id || req.user._id || req.user.email,
      users: [],
    });
    await room.save();
    console.log(`Room created: ${name} (${isPublic ? 'Public' : 'Private'}) by ${req.user.id}`);
    res.status(201).json({ message: 'Room created', room });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/rooms/:name - get room info
router.get('/:name', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ name: req.params.name });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ room });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:name/verify-password - verify password for private room
router.post('/:name/verify-password', auth, async (req, res) => {
  try {
    const { password } = req.body;
    const room = await Room.findOne({ name: req.params.name });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Public rooms don't need password
    if (room.isPublic) {
      return res.json({ success: true, message: 'Public room - no password needed' });
    }
    
    // Check password for private rooms
    if (room.password === password) {
      return res.json({ success: true, message: 'Password correct' });
    } else {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/rooms/:name - delete a room
router.delete('/:name', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ name: req.params.name });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if user is the room host
    const userId = req.user.id || req.user._id || req.user.email;
    if (room.host !== userId) {
      return res.status(403).json({ message: 'Only the room host can delete a room' });
    }
    
    // Delete the room
    await Room.deleteOne({ name: req.params.name });
    
    // Also delete all messages associated with this room
    const Message = require('../models/Message');
    await Message.deleteMany({ room: req.params.name });
    
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('Error deleting room:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
