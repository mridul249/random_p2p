// client.js
const io = require('socket.io-client');
const Peer = require('peerjs').Peer;
const fs = require('fs-extra');
const path = require('path');
// const inquirer = require('inquirer');
const inquirer = require('inquirer').default;


const socket = io('http://localhost:3000');
const peer = new Peer(undefined, {
    host: 'localhost',
    port: 9000,
    path: '/',
    secure: false  // This line explicitly sets the secure option to avoid using 'location'
  });
  
let connectedPeers = {};

peer.on('open', (id) => {
  console.log('My peer ID is:', id);
});

peer.on('connection', (conn) => {
  console.log('Connected to:', conn.peer);
  connectedPeers[conn.peer] = conn;

  conn.on('data', (data) => {
    if (data.type === 'file-request') {
      sendFile(conn, data.filename);
    }
  });
});

socket.on('existing-peers', (peers) => {
  peers.forEach(peerInfo => connectToPeer(peerInfo.id));
});

socket.on('new-peer', (peerInfo) => connectToPeer(peerInfo.id));
socket.on('peer-disconnected', (peerInfo) => {
  if (connectedPeers[peerInfo.id]) {
    connectedPeers[peerInfo.id].close();
    delete connectedPeers[peerInfo.id];
  }
});

function connectToPeer(peerId) {
  if (peerId === peer.id || connectedPeers[peerId]) return;

  const conn = peer.connect(peerId);

  conn.on('open', () => {
    console.log('Connected to peer:', peerId);
    connectedPeers[peerId] = conn;
  });

  conn.on('data', (data) => {
    if (data.type === 'file-request') sendFile(conn, data.filename);
  });

  conn.on('close', () => delete connectedPeers[peerId]);
}

function sendFile(conn, filename) {
  const filePath = path.join(__dirname, 'shared', filename);
  if (fs.existsSync(filePath)) {
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('data', (chunk) => {
      conn.send({ type: 'file-chunk', filename, data: chunk.toString('base64') });
    });
    fileStream.on('end', () => conn.send({ type: 'file-end', filename }));
  } else {
    conn.send({ type: 'error', message: 'File not found' });
  }
}

async function mainMenu() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select an action:',
      choices: ['List Peers', 'Send File', 'Receive Files', 'Exit'],
    },
  ]);

  switch (answers.action) {
    case 'List Peers':
      console.log('Connected peers:', Object.keys(connectedPeers));
      break;
    case 'Send File':
      await sendFilePrompt();
      break;
    case 'Receive Files':
      console.log('Waiting to receive files...');
      break;
    case 'Exit':
      process.exit(0);
  }

  mainMenu();
}

async function sendFilePrompt() {
  const peerIds = Object.keys(connectedPeers);
  if (peerIds.length === 0) {
    console.log('No connected peers to send files to.');
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'peerId',
      message: 'Select a peer to send the file to:',
      choices: peerIds,
    },
    {
      type: 'input',
      name: 'filePath',
      message: 'Enter the path of the file to send:',
      validate: (input) => fs.existsSync(input) || 'File does not exist.',
    },
  ]);

  const conn = connectedPeers[answers.peerId];
  const filename = path.basename(answers.filePath);
  conn.send({ type: 'file-request', filename });

  const fileStream = fs.createReadStream(answers.filePath);
  fileStream.on('data', (chunk) => conn.send({ type: 'file-chunk', filename, data: chunk.toString('base64') }));
  fileStream.on('end', () => console.log(`Finished sending ${filename} to ${answers.peerId}`));
}

peer.on('connection', (conn) => {
  conn.on('data', (data) => {
    if (data.type === 'file-chunk') {
      const buffer = Buffer.from(data.data, 'base64');
      const filePath = path.join(__dirname, 'downloads', data.filename);
      fs.ensureDirSync(path.dirname(filePath));
      fs.appendFileSync(filePath, buffer);
    } else if (data.type === 'file-end') {
      console.log(`Finished receiving ${data.filename}`);
    } else if (data.type === 'error') {
      console.error(`Error from peer: ${data.message}`);
    }
  });
});

mainMenu();
