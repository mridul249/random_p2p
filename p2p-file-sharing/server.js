// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let peers = [];

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.broadcast.emit('new-peer', { id: socket.id });
  socket.emit('existing-peers', peers);
  peers.push({ id: socket.id });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    peers = peers.filter(peer => peer.id !== socket.id);
    socket.broadcast.emit('peer-disconnected', { id: socket.id });
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));
