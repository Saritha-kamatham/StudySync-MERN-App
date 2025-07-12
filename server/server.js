// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [
          "https://study-sync-mern-project.vercel.app",
          "https://*.vercel.app"
        ]
      : "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Prioritize polling for Render.com compatibility
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  // Render-specific configurations
  pingTimeout: 120000,  // Increased for better stability
  pingInterval: 25000,
  connectTimeout: 60000,
  // Force polling for more reliable connections on Render
  forceNew: true,
  // Additional headers for better compatibility
  extraHeaders: {
    "Access-Control-Allow-Origin": process.env.NODE_ENV === 'production' 
      ? "https://study-sync-mern-project.vercel.app"
      : "http://localhost:5173"
  }
});

// Create rooms object to track active users
const socketRooms = {};

// Store io and socketRooms in app for routes to access
app.set('io', io);
app.set('socketRooms', socketRooms);

// Initialize socket handling with the rooms object
require('./sockets/socket')(io, socketRooms);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ["https://study-sync-mern-project.vercel.app", "https://*.vercel.app"]
    : "http://localhost:5173",
  credentials: true
}));

// Additional middleware for Socket.IO on Render
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
    ? 'https://study-sync-mern-project.vercel.app' 
    : 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Root route for health check or friendly message
app.get('/', (req, res) => {
  res.send('StudySync API is running');
});

// Socket.IO health check
app.get('/socket.io/health', (req, res) => {
  res.json({ 
    status: 'Socket.IO server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    transport: 'polling preferred'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
