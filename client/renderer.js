// renderer.js

console.log('renderer.js loaded successfully');

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { ipcRenderer } = require('electron'); // Import ipcRenderer

const serverUrl = 'http://10.35.13.164:5001'; // Ensure this matches your server's address

// UI Elements
const loginSection = document.getElementById('loginSection');
const filesSection = document.getElementById('filesSection');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const shareFileBtn = document.getElementById('shareFileBtn');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');
const downloadFileBtn = document.getElementById('downloadFileBtn');
const filesList = document.getElementById('filesList');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchFilenameInput = document.getElementById('searchFilename');
const searchUsernameInput = document.getElementById('searchUsername');
const progressBar = document.getElementById('progressBar');
const statusLabel = document.getElementById('statusLabel');
const speedLabel = document.getElementById('speedLabel');

let username = null;
let isLoggedIn = false;
let listeningPort = findFreePort();
let localIP = getLocalIP();
let heartbeatInterval = null;

// Initialize Directories
const sharedDir = path.join(__dirname, 'shared_files');
const downloadsDir = path.join(__dirname, 'downloads');

if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir);
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

// Utility Functions
function findFreePort() {
    const server = net.createServer();
    server.listen(0);
    const port = server.address().port;
    server.close();
    return port;
}

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

// Event Listeners
loginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', register);
shareFileBtn.addEventListener('click', shareFile);
refreshFilesBtn.addEventListener('click', fetchFiles);
downloadFileBtn.addEventListener('click', downloadFile);
searchBtn.addEventListener('click', searchFiles);
clearSearchBtn.addEventListener('click', clearSearch);

// Login Function
async function login() {
    console.log('Login button clicked');

    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();

    console.log(`Username: ${user}, Password: ${pass}`);

    if (!user || !pass) {
        alert('Please enter both username and password');
        console.log('Login failed: Missing credentials');
        return;
    }

    try {
        const response = await axios.post(`${serverUrl}/login`, {
            username: user,
            password: pass,
            ip: localIP,
            port: listeningPort,
        });

        console.log(`Login response status: ${response.status}`);
        console.log(`Login response data:`, response.data);

        if (response.status === 200) {
            username = user;
            isLoggedIn = true;
            loginSection.classList.add('hidden');
            filesSection.classList.remove('hidden');
            startHeartbeat();
            startPeerServer();
            shareFiles();
            fetchFiles();
            alert('Login successful!');
            console.log('Login successful');
        } else {
            alert(`Login failed: ${response.data.message}`);
            console.log('Login failed:', response.data.message);
        }
    } catch (error) {
        if (error.response) {
            // Server responded with a status other than 2xx
            alert(`Login failed: ${error.response.data.message}`);
            console.log(`Login failed: ${error.response.data.message}`);
        } else if (error.request) {
            // No response received
            alert('Login failed: No response from server');
            console.log('Login failed: No response from server');
        } else {
            // Other errors
            alert(`Login failed: ${error.message}`);
            console.log(`Login failed: ${error.message}`);
        }
        console.error('Login Error:', error);
    }
}

// Register Function
async function register() {
    console.log('Register button clicked');

    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();

    console.log(`Username: ${user}, Password: ${pass}`);

    if (!user || !pass) {
        alert('Please enter both username and password');
        console.log('Registration failed: Missing credentials');
        return;
    }

    try {
        const response = await axios.post(`${serverUrl}/register`, {
            username: user,
            password: pass,
            ip: localIP,
            port: listeningPort,
        });

        console.log(`Register response status: ${response.status}`);
        console.log(`Register response data:`, response.data);

        if (response.status === 200) {
            alert('Registration successful! Please login.');
            console.log('Registration successful');
        } else {
            alert(`Registration failed: ${response.data.message}`);
            console.log('Registration failed:', response.data.message);
        }
    } catch (error) {
        if (error.response) {
            // Server responded with a status other than 2xx
            alert(`Registration failed: ${error.response.data.message}`);
            console.log(`Registration failed: ${error.response.data.message}`);
        } else if (error.request) {
            // No response received
            alert('Registration failed: No response from server');
            console.log('Registration failed: No response from server');
        } else {
            // Other errors
            alert(`Registration failed: ${error.message}`);
            console.log(`Registration failed: ${error.message}`);
        }
        console.error('Registration Error:', error);
    }
}

// Heartbeat Function
function startHeartbeat() {
    console.log('Starting heartbeat...');
    heartbeatInterval = setInterval(async () => {
        try {
            await axios.post(`${serverUrl}/heartbeat`, {
                username,
                ip: localIP,
                port: listeningPort,
            });
            console.log('Heartbeat sent');
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }, 30000); // Every 30 seconds
}

// Share File Function using IPC
async function shareFile() {
    try {
        const result = await ipcRenderer.invoke('dialog:open', {
            properties: ['openFile', 'multiSelections'],
        });

        if (result.canceled) return;

        const filePaths = result.filePaths;
        const files = filePaths.map((filePath) => path.basename(filePath));

        console.log(`Sharing files: ${files}`);

        // Copy files to shared directory
        for (const filePath of filePaths) {
            const destPath = path.join(sharedDir, path.basename(filePath));
            fs.copyFileSync(filePath, destPath);
            console.log(`Copied file to shared directory: ${destPath}`);
        }

        // Share with server
        try {
            const response = await axios.post(`${serverUrl}/share_files`, {
                username,
                filename: files,
                peer_ip: localIP,
                peer_port: listeningPort,
            });

            console.log(`Share files response status: ${response.status}`);
            console.log(`Share files response data:`, response.data);

            if (response.status === 200) {
                alert('Files shared successfully!');
                fetchFiles();
            } else {
                alert(`Failed to share files: ${response.data.message}`);
                console.log('Share Files failed:', response.data.message);
            }
        } catch (error) {
            if (error.response) {
                alert(`Failed to share files: ${error.response.data.message}`);
            } else if (error.request) {
                alert('Failed to share files: No response from server');
            } else {
                alert(`Failed to share files: ${error.message}`);
            }
            console.error('Share Files Error:', error);
        }
    } catch (error) {
        console.error('Open Dialog Error:', error);
    }
}

// Share Files on Login
async function shareFiles() {
    const files = fs.readdirSync(sharedDir).filter((file) => fs.statSync(path.join(sharedDir, file)).isFile());

    if (files.length === 0) {
        console.log('No files to share');
        return;
    }

    console.log(`Sharing existing files: ${files}`);

    try {
        const response = await axios.post(`${serverUrl}/share_files`, {
            username,
            filename: files,
            peer_ip: localIP,
            peer_port: listeningPort,
        });

        console.log(`Share files on login response status: ${response.status}`);
        console.log(`Share files on login response data:`, response.data);

        if (response.status !== 200) {
            alert(`Failed to share files on login: ${response.data.message}`);
        }
    } catch (error) {
        if (error.response) {
            alert(`Failed to share files on login: ${error.response.data.message}`);
        } else if (error.request) {
            alert('Failed to share files on login: No response from server');
        } else {
            alert(`Failed to share files on login: ${error.message}`);
        }
        console.error('Share Files on Login Error:', error);
    }
}

// Fetch Files Function
async function fetchFiles() {
    console.log('Fetching files...');
    try {
        const response = await axios.get(`${serverUrl}/files`);
        console.log(`Fetch files response status: ${response.status}`);
        console.log(`Fetch files response data:`, response.data);

        if (response.status === 200) {
            const files = response.data.files;
            displayFiles(files);
        } else {
            alert(`Failed to fetch files: ${response.data.message}`);
        }
    } catch (error) {
        if (error.response) {
            alert(`Failed to fetch files: ${error.response.data.message}`);
        } else if (error.request) {
            alert('Failed to fetch files: No response from server');
        } else {
            alert(`Failed to fetch files: ${error.message}`);
        }
        console.error('Fetch Files Error:', error);
    }
}

// Display Files in Textarea
function displayFiles(files) {
    filesList.value = '';
    files.forEach((file) => {
        filesList.value += `${file.filename} (Shared by ${file.username} at ${file.peer_ip}:${file.peer_port})\n`;
    });
}

// Search Files Function
async function searchFiles() {
    const filename = searchFilenameInput.value.trim();
    const usernameSearch = searchUsernameInput.value.trim();

    console.log(`Searching files: Filename="${filename}", Username="${usernameSearch}"`);

    try {
        const response = await axios.get(`${serverUrl}/search_files`, {
            params: { filename, username: usernameSearch },
        });

        console.log(`Search files response status: ${response.status}`);
        console.log(`Search files response data:`, response.data);

        if (response.status === 200) {
            const files = response.data.files;
            displayFiles(files);
        } else {
            alert(`Failed to search files: ${response.data.message}`);
        }
    } catch (error) {
        if (error.response) {
            alert(`Failed to search files: ${error.response.data.message}`);
        } else if (error.request) {
            alert('Failed to search files: No response from server');
        } else {
            alert(`Failed to search files: ${error.message}`);
        }
        console.error('Search Files Error:', error);
    }
}

// Clear Search Function
function clearSearch() {
    searchFilenameInput.value = '';
    searchUsernameInput.value = '';
    fetchFiles();
}

// Download File Function
function downloadFile() {
    const selectedText = filesList.value.trim();
    if (!selectedText) {
        alert('Please select a file to download');
        return;
    }

    // Prompt user to enter the exact filename to download
    const selectedFile = prompt('Enter the exact filename you wish to download:', '');
    if (!selectedFile) {
        alert('No file selected for download');
        return;
    }

    // Find the matching file entry
    const matchingFiles = filesList.value.split('\n').filter(line => line.startsWith(selectedFile));

    if (matchingFiles.length === 0) {
        alert('File not found in the list');
        return;
    }

    const fileEntry = matchingFiles[0];
    const regex = /(.*) \(Shared by (.*) at (.*):(\d+)\)/;
    const match = fileEntry.match(regex);

    if (!match) {
        alert('Invalid file format');
        return;
    }

    const filename = match[1];
    const peerIP = match[3];
    const peerPort = parseInt(match[4]);

    console.log(`Attempting to download file: ${filename} from ${peerIP}:${peerPort}`);

    // Start Download in a New Thread
    downloadFromPeer(peerIP, peerPort, filename);
}

// Download from Peer Function
function downloadFromPeer(peerIP, peerPort, filename) {
    statusLabel.textContent = 'Connecting to peer...';
    progressBar.value = 0;
    speedLabel.textContent = 'Transfer Speed: 0 KB/s';

    const client = new net.Socket();
    let fileSize = 0;
    let received = 0;
    let fileStream = null;
    let startTime = Date.now();
    let lastTime = startTime;
    let bytesSinceLast = 0;

    client.connect(peerPort, peerIP, () => {
        console.log(`Connected to peer at ${peerIP}:${peerPort}`);
        client.write(filename);
    });

    client.on('data', (data) => {
        if (!fileSize) {
            const response = data.toString();
            if (response === 'FILE_NOT_FOUND') {
                alert('File not found on peer');
                client.destroy();
                console.warn(`File not found on peer: ${filename}`);
                return;
            }
            fileSize = parseInt(response);
            const savePath = path.join(downloadsDir, filename);
            fileStream = fs.createWriteStream(savePath);
            statusLabel.textContent = 'Downloading...';
            console.log(`Starting download of ${filename} (${fileSize} bytes)`);
        } else {
            fileStream.write(data);
            received += data.length;
            bytesSinceLast += data.length;

            // Update Progress
            const progress = (received / fileSize) * 100;
            progressBar.value = progress;

            // Update Speed
            const currentTime = Date.now();
            const elapsed = (currentTime - lastTime) / 1000; // seconds
            if (elapsed >= 1) {
                const speed = bytesSinceLast / 1024 / elapsed; // KB/s
                speedLabel.textContent = `Transfer Speed: ${speed.toFixed(2)} KB/s`;
                lastTime = currentTime;
                bytesSinceLast = 0;
            }
        }
    });

    client.on('close', () => {
        if (fileStream) fileStream.close();
        statusLabel.textContent = 'Download complete!';
        speedLabel.textContent = 'Transfer Speed: 0 KB/s';
        progressBar.value = 0;
        alert(`File "${filename}" downloaded successfully!`);
        console.log(`Download complete: ${filename}`);
    });

    client.on('error', (err) => {
        console.error('Download Error:', err);
        alert('Failed to download file');
        statusLabel.textContent = 'Download failed!';
        progressBar.value = 0;
        speedLabel.textContent = 'Transfer Speed: 0 KB/s';
    });
}

// Peer Server to Serve Files
function startPeerServer() {
    console.log(`Starting peer server on ${localIP}:${listeningPort}`);
    const server = net.createServer((socket) => {
        console.log(`Incoming connection from ${socket.remoteAddress}:${socket.remotePort}`);
        socket.on('data', (data) => {
            const requestedFile = data.toString().trim();
            const filePath = path.join(sharedDir, requestedFile);
            console.log(`Peer requested file: ${requestedFile}`);

            if (!fs.existsSync(filePath)) {
                socket.write('FILE_NOT_FOUND');
                console.warn(`File not found: ${requestedFile}`);
                socket.destroy();
                return;
            }

            const stats = fs.statSync(filePath);
            socket.write(stats.size.toString());
            console.log(`Sending file size: ${stats.size} bytes`);

            const readStream = fs.createReadStream(filePath);
            readStream.on('data', (chunk) => {
                socket.write(chunk);
            });

            readStream.on('end', () => {
                console.log(`Finished sending file: ${requestedFile}`);
                socket.end();
            });

            readStream.on('error', (err) => {
                console.error(`Error reading file ${requestedFile}:`, err);
                socket.end();
            });
        });

        socket.on('error', (err) => {
            console.error(`Socket error from ${socket.remoteAddress}:${socket.remotePort}:`, err);
        });
    });

    server.listen(listeningPort, localIP, () => {
        console.log(`Peer server listening on ${localIP}:${listeningPort}`);
    });

    server.on('error', (err) => {
        console.error('Peer server error:', err);
    });
}

// Cleanup on Exit
window.onbeforeunload = async () => {
    if (isLoggedIn) {
        clearInterval(heartbeatInterval);
        try {
            const response = await axios.post(`${serverUrl}/disconnect`, { username });
            console.log(`Disconnected from server: ${username}`);
        } catch (error) {
            console.error('Failed to disconnect from server:', error);
        }
    }
};
