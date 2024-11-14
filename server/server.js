// server.js

const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const cors = require('cors');
const { Op } = require('sequelize');
const morgan = require('morgan'); // For HTTP request logging
const bcrypt = require('bcrypt');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('dev')); // Logs HTTP requests

// Initialize SQLite database using Sequelize
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'p2p.db',
    logging: false,
});

// Define Peer model
const Peer = sequelize.define('peer', {
    username: {
        type: Sequelize.STRING,
        primaryKey: true,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    ip: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    port: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    last_seen: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    last_heartbeat: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
});

// Define File model
const File = sequelize.define('file', {
    filename: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    peer_ip: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    peer_port: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    shared_time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
});

// Associations
Peer.hasMany(File, { foreignKey: 'username', sourceKey: 'username' });
File.belongsTo(Peer, { foreignKey: 'username', targetKey: 'username' });

// Initialize Database
sequelize.sync()
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch((err) => {
        console.error('Error creating database:', err);
    });

// Routes

// Registration Endpoint
app.post('/register', async (req, res) => {
    const { username, password, ip, port } = req.body;
    console.log(`Registration attempt: Username=${username}, IP=${ip}, Port=${port}`);

    if (!username || !password || !ip || !port) {
        console.error('Registration failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields!' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await Peer.create({ username, password: hashedPassword, ip, port });
        console.log(`User registered: ${username}`);
        res.json({ message: 'Registration successful!' });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.error(`Registration failed: Username "${username}" already exists`);
            res.status(400).json({ message: 'Username already exists!' });
        } else {
            console.error(`Registration error: ${error.message}`);
            res.status(500).json({ message: 'Server error!' });
        }
    }
});

// Login Endpoint
app.post('/login', async (req, res) => {
    const { username, password, ip, port } = req.body;
    console.log(`Login attempt: Username=${username}, IP=${ip}, Port=${port}`);

    if (!username || !password) {
        console.error('Login failed: Missing credentials');
        return res.status(400).json({ message: 'Missing credentials!' });
    }

    try {
        const peer = await Peer.findOne({ where: { username } });
        if (peer) {
            const passwordMatch = await bcrypt.compare(password, peer.password);
            if (passwordMatch) {
                // Update last_seen, ip, and port
                peer.last_seen = new Date();
                peer.ip = ip;
                peer.port = port;
                await peer.save();
                console.log(`Login successful: Username=${username}`);
                res.json({ message: 'Login successful!', username: peer.username });
            } else {
                console.warn(`Login failed: Invalid password for Username=${username}`);
                res.status(401).json({ message: 'Invalid credentials!' });
            }
        } else {
            console.warn(`Login failed: Username=${username} not found`);
            res.status(401).json({ message: 'Invalid credentials!' });
        }
    } catch (error) {
        console.error(`Login error for Username=${username}: ${error.message}`);
        res.status(500).json({ message: 'Server error!' });
    }
});

// Heartbeat Endpoint
app.post('/heartbeat', async (req, res) => {
    const { username, ip, port } = req.body;
    console.log(`Heartbeat received: Username=${username}, IP=${ip}, Port=${port}`);

    if (!username || !ip || !port) {
        console.error('Heartbeat failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields!' });
    }

    try {
        const peer = await Peer.findOne({ where: { username } });
        if (peer) {
            peer.last_heartbeat = new Date();
            peer.ip = ip;
            peer.port = port;
            await peer.save();
            console.log(`Heartbeat updated: Username=${username}`);
            res.json({ message: 'Heartbeat received' });
        } else {
            console.warn(`Heartbeat failed: Username=${username} not found`);
            res.status(404).json({ message: 'Peer not found' });
        }
    } catch (error) {
        console.error(`Heartbeat error for Username=${username}: ${error.message}`);
        res.status(500).json({ message: 'Server error!' });
    }
});

// Disconnect Endpoint
app.post('/disconnect', async (req, res) => {
    const { username } = req.body;
    console.log(`Disconnect request: Username=${username}`);

    if (!username) {
        console.error('Disconnect failed: Missing username');
        return res.status(400).json({ message: 'Missing username!' });
    }

    try {
        // Remove files shared by the peer
        await File.destroy({ where: { username } });
        // Remove the peer
        await Peer.destroy({ where: { username } });
        console.log(`User disconnected: Username=${username}`);
        res.json({ message: 'Disconnected successfully' });
    } catch (error) {
        console.error(`Disconnect error for Username=${username}: ${error.message}`);
        res.status(500).json({ message: 'Server error!' });
    }
});

// Share Files Endpoint
app.post('/share_files', async (req, res) => {
    const { username, filename, peer_ip, peer_port } = req.body;
    console.log(`Share files request: Username=${username}, Files=${filename}, IP=${peer_ip}, Port=${peer_port}`);

    if (!username || !filename || !peer_ip || !peer_port) {
        console.error('Share files failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields!' });
    }

    try {
        // Remove previous files shared by this peer
        await File.destroy({ where: { username } });

        // Add new files
        const fileEntries = filename.map((fname) => ({
            filename: fname,
            username,
            peer_ip,
            peer_port,
        }));

        await File.bulkCreate(fileEntries);
        console.log(`Files shared by ${username}: ${filename}`);
        res.json({ message: 'Files shared successfully!' });
    } catch (error) {
        console.error(`Share files error for Username=${username}: ${error.message}`);
        res.status(500).json({ message: 'Server error!' });
    }
});

// Get Files Endpoint
app.get('/files', async (req, res) => {
    const { filename = '', username = '' } = req.query;
    const thresholdTime = new Date(Date.now() - 60000); // 60 seconds ago
    console.log(`Get files request: Filename=${filename}, Username=${username}`);

    try {
        const files = await File.findAll({
            where: {
                filename: { [Op.like]: `%${filename}%` },
                username: { [Op.like]: `%${username}%` },
            },
            include: [{
                model: Peer,
                where: {
                    last_heartbeat: { [Op.gte]: thresholdTime },
                },
            }],
        });

        console.log(`Files retrieved: ${files.length} files`);
        res.json({ files });
    } catch (error) {
        console.error(`Get files error: ${error.message}`);
        res.status(500).json({ message: 'Server error!' });
    }
});

// Search Files Endpoint (Same as Get Files)
app.get('/search_files', async (req, res) => {
    const { filename = '', username = '' } = req.query;
    const thresholdTime = new Date(Date.now() - 60000); // 60 seconds ago
    console.log(`Search files request: Filename=${filename}, Username=${username}`);

    try {
        const files = await File.findAll({
            where: {
                filename: { [Op.like]: `%${filename}%` },
                username: { [Op.like]: `%${username}%` },
            },
            include: [{
                model: Peer,
                where: {
                    last_heartbeat: { [Op.gte]: thresholdTime },
                },
            }],
        });

        console.log(`Search files retrieved: ${files.length} files`);
        res.json({ files });
    } catch (error) {
        console.error(`Search files error: ${error.message}`);
        res.status(500).json({ message: 'Server error!' });
    }
});

// Cleanup Inactive Peers
const cleanupInactivePeers = async () => {
    const thresholdTime = new Date(Date.now() - 60000); // 60 seconds ago
    console.log('Running cleanup of inactive peers...');

    try {
        const inactivePeers = await Peer.findAll({
            where: {
                last_heartbeat: { [Op.lt]: thresholdTime },
            },
        });

        for (const peer of inactivePeers) {
            console.log(`Removing files for inactive peer: ${peer.username}`);
            await File.destroy({ where: { username: peer.username } });
            await Peer.destroy({ where: { username: peer.username } });
        }
    } catch (error) {
        console.error(`Cleanup error: ${error.message}`);
    }
};

// Run cleanup every 30 seconds
setInterval(cleanupInactivePeers, 30000);

// Start Server
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
