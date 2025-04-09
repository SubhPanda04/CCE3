const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket'],  // Force WebSocket transport
  allowEIO3: true  // Enable Socket.IO v3 compatibility
});

// Store active rooms and their participants
const rooms = new Map();

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining a room
  socket.on('join-room', ({ roomId, userId, userName }) => {
    console.log(`${userName} (${userId}) joining room: ${roomId}`);
    
    // Join the socket.io room
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    
    // Add user to room
    rooms.get(roomId).set(userId, {
      id: userId,
      name: userName,
      socketId: socket.id
    });
    
    // Store room info in socket for easy access on disconnect
    socket.roomId = roomId;
    socket.userId = userId;
    socket.userName = userName;
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      userId,
      userName
    });
    
    // Send current users list to the new user
    const users = Array.from(rooms.get(roomId).values()).map(user => user.name);
    
    io.to(socket.id).emit('room-users', { users });
    
    // Broadcast updated users list to everyone in the room
    io.to(roomId).emit('room-users', { users });
  });

  // Handle code changes
  socket.on('code-change', ({ roomId, code, userId }) => {
    // Broadcast to everyone in the room except sender
    socket.to(roomId).emit('code-update', {
      code,
      userId
    });
  });

  // Handle input changes for IOPanel
  socket.on('input-change', ({ roomId, input, userId }) => {
    socket.to(roomId).emit('input-update', {
      input,
      userId
    });
  });

  // Handle cursor position updates
  socket.on('cursor-move', ({ roomId, cursorPosition, userId }) => {
    socket.to(roomId).emit('cursor-update', {
      cursorPosition,
      userId
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const { roomId, userId, userName } = socket;
    
    if (roomId && rooms.has(roomId)) {
      // Remove user from room
      rooms.get(roomId).delete(userId);
      
      // If room is empty, remove it
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      } else {
        // Notify others that user has left
        socket.to(roomId).emit('user-left', {
          userId,
          userName
        });
        
        // Broadcast updated users list
        const users = Array.from(rooms.get(roomId).values()).map(user => user.name);
        io.to(roomId).emit('room-users', { users });
      }
    }
    
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.send('Collaborative Code Editor Backend is running');
});

// Update the port binding configuration
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// Add more detailed logging
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Attempting to bind to ${HOST}:${PORT}`);
console.log(`FRONTEND_URL set to: ${process.env.FRONTEND_URL || 'not set'}`);

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Server bound to all interfaces (0.0.0.0)`);
});

// Add an error handler for the server
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port.`);
  }
});