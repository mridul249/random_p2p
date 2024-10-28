// public/script.js
const socket = io();
let peerConnection;
let dataChannel;
// const configuration = {
//   iceServers: [
//     { urls: "stun:stun.l.google.com:19302" },
//     {
//       urls: "turn:157.42.229.145:3478",
//       username: "mridul",
//       credential: "mridul",
//     },
//   ],
// };

const configuration = {
  iceServers: [
  ],
};
// {
//   urls: 'turn:numb.viagenie.ca',
//   username: 'webrtc@live.com',
//   credential: 'muazkh',
// },


const roomIdInput = document.getElementById('roomId');
const joinButton = document.getElementById('joinButton');
const connectedDiv = document.getElementById('connected');
const statusParagraph = document.getElementById('status');
const sendFileButton = document.getElementById('sendFile');
const fileInput = document.getElementById('fileInput');

let roomId;
let isInitiator = false;

joinButton.onclick = () => {
  roomId = roomIdInput.value;
  if (roomId) {
    socket.emit('join-room', roomId);
    console.log(`Attempting to join room: ${roomId}`);
    statusParagraph.textContent = `Joined room: ${roomId}`;
    console.log(`Joined room: ${roomId}`);
    connectedDiv.style.display = 'block';
  } else {
    alert('Please enter a room ID');
  }
};

socket.on('user-connected', (userId) => {
  console.log(`User connected: ${userId}`);
  isInitiator = true;
  startPeerConnection(userId);
});

socket.on('signal', async (data) => {
  const { signalData, senderId } = data;

  if (!peerConnection) {
    startPeerConnection(senderId);
  }

  if (signalData.type === 'offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', {
      roomId,
      signalData: peerConnection.localDescription,
    });
  } else if (signalData.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData));
  } else if (signalData.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
  }
});

function startPeerConnection(userId) {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('signal', {
        roomId,
        signalData: { candidate },
      });
    }
  };

  if (isInitiator) {
    dataChannel = peerConnection.createDataChannel('fileTransfer');
    setupDataChannel();
    createOffer();
  } else {
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel();
    };
  }

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      statusParagraph.textContent = 'Connected to peer';
    }
  };
}

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', {
    roomId,
    signalData: peerConnection.localDescription,
  });
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log('Data channel opened');
  };

  dataChannel.onmessage = (event) => {
    receiveFile(event.data);
  };
}

sendFileButton.onclick = () => {
  const file = fileInput.files[0];
  if (file) {
    sendFile(file);
  } else {
    alert('Please select a file to send');
  }
};

function sendFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    dataChannel.send(reader.result);
    statusParagraph.textContent = 'File sent';
  };
  reader.readAsArrayBuffer(file);
}

function receiveFile(data) {
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'received_file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  statusParagraph.textContent = 'File received';
}