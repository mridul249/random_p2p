// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const app = express();
const server = http.createServer(app);
// const io = socketIO(server);

// Serve static files from the public directory
app.use(express.static('public'));
const cors = require('cors');
app.use(cors());
const io = socketIO(server, {
  transports: ['websocket'], // Force WebSocket transport
  cors: {
    origin: "*", // Adjust if you access from another domain
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});


io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Handle joining a room
  socket.on('join-room', (roomId) => {
    console.log(`Client ${socket.id} is joining room ${roomId}`);
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;

    if (numClients === 0) {
      socket.join(roomId);
      socket.emit('created');
      console.log(`Client ${socket.id} created room: ${roomId}`);
    } else if (numClients === 1) {
      socket.join(roomId);
      socket.emit('joined');
      console.log(`Client ${socket.id} joined room: ${roomId}`);
      socket.to(roomId).emit('user-connected', socket.id);
    } else {
      socket.emit('full');
      console.log(`Room ${roomId} is full`);
    }
  });

  // Relay signals to peers in the same room
  socket.on('signal', (data) => {
    console.log(`Relaying signal from ${socket.id} in room ${data.roomId}`);
    const { roomId, signalData } = data;
    console.log(`Relaying signal from ${socket.id} to room ${roomId}`);
    socket.to(roomId).emit('signal', {
      signalData,
      senderId: socket.id,
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    console.log('Client disconnected:', socket.id);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
  });
});


const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
