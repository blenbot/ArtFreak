require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils.js');
const crypto = require('crypto');
const cors = require('cors');
const Y = require('yjs');
const path = require('path');
const fs = require("node:fs");
const mime = require("mime-types");
const environment = process.env.ENVIRONMENT || 'production';

const port = process.env.PORT || 1234;
const host = process.env.HOST || '0.0.0.0';

class RateLimiter {
  constructor(windowMs = 60000, maxConnections = 200) {
    this.windowMs = windowMs;
    this.maxConnections = maxConnections;
    this.connections = new Map();
  }

  isRateLimited(ip) {
    const now = Date.now();
    const history = this.connections.get(ip) || [];
    
    // Keep only connections within the time window
    const recentConnections = history.filter(ts => now - ts < this.windowMs);
    
    // Add new connection timestamp
    recentConnections.push(now);
    this.connections.set(ip, recentConnections);

    return recentConnections.length > this.maxConnections;
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, timestamps] of this.connections.entries()) {
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      if (valid.length === 0) {
        this.connections.delete(ip);
      } else {
        this.connections.set(ip, valid);
      }
    }
  }
}

const sanitizeInput = (input) => {
  return input
    .replace(/[&<>"']/g, (char) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return entities[char];
    })
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .slice(0, 16); // Limit length
};

const clients = new Map();
const rooms = new Map();
const ROOM_CLEANUP_DELAY = 10 * 60 * 1000; // 10 minutes
const roomTimeouts = new Map();
const WSrateLimiter = new RateLimiter(5000, 30); // 30 connections every 5 seconds
const httpRateLimiter = new RateLimiter(5000, 10); // 10 requests every 5 seconds

setInterval(() => WSrateLimiter.cleanup(), 10000);
setInterval(() => httpRateLimiter.cleanup(), 10000);

const INACTIVE_TIMEOUT = 10 * 60 * 1000; // 10 minutes inactivity timeout
const HEARTBEAT_INTERVAL = 30 * 1000;   // Send heartbeat every 30 seconds

// Clean up inactive users every minute
setInterval(() => {
  const now = Date.now();
  for (const [clientId, client] of clients.entries()) {
    if (now - client.lastActive > INACTIVE_TIMEOUT) {
      console.log(`Cleaning up inactive user ${client.userName} in room ${client.roomCode}`);
      client.ws.close(1000, 'Inactive timeout');
      clients.delete(clientId);

      // Notify remaining users in the room about the user leaving
      const remainingUsers = Array.from(clients.values())
        .filter(c => c.roomCode === client.roomCode)
        .map(c => ({
          clientID: c.id,
          userName: c.userName,
          color: c.color,
          roomCode: c.roomCode
        }));

      if (remainingUsers.length === 0) {
        scheduleRoomCleanup(client.roomCode);
      }

      wss.clients.forEach((wsClient) => {
        const clientData = Array.from(clients.values()).find(c => c.ws === wsClient);
        if (wsClient.readyState === WebSocket.OPEN && clientData?.roomCode === client.roomCode) {
          wsClient.send(JSON.stringify({
            type: 'active-users',
            users: remainingUsers
          }));
        }
      });
    }
  }
}, 60000);

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress;
  if (httpRateLimiter.isRateLimited(ip)) {
    console.warn(`Too many requests from ${ip}`);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return;
  }
  const corsMiddleware = cors({
    origin: environment === 'production' 
      ? ['https://artfreak.vercel.app', 'https://www.artfreak.vercel.app'] 
      : ['http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });
  
  corsMiddleware(req, res, () => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeConnections: wss.clients.size,
        activeRooms: rooms.size
      }));
    } else if (req.url === '/create-room') {
      const roomCode = crypto.randomUUID().slice(0, 4);
      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Y.Doc());
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ roomCode }));
    } else if (req.url.startsWith('/check-room')) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const roomCode = url.searchParams.get('roomCode');
      const exists = rooms.has(roomCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exists }));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ArtFreak WebSocket Server is running\n');
    }
  });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  if (WSrateLimiter.isRateLimited(ip)) {
    console.warn(`Too many connections from ${ip}`);
    ws.close(1008, 'Too many connections from your IP');
    return;
  }

  const url = new URL(req.url, `ws://${req.headers.host}`);
  const roomCode = url.searchParams.get('room');
  const connectionType = url.searchParams.get('type')?.split('/')[0];
  const userName = sanitizeInput(url.searchParams.get('username')?.split('/')[0]) || `User-${Math.floor(Math.random() * 1000)}`;
  const userColor = /^#[0-9A-F]{6}$/i.test(url.searchParams.get('color')) 
    ? url.searchParams.get('color')
    : `#${Math.floor(Math.random() * 16777215).toString(16)}`;

  if (!roomCode) {
    ws.close(1000, 'No room code provided');
    return;
  }

  const pathParts = url.pathname.split('/');
  const docName = pathParts[pathParts.length - 1] || roomCode;
  const roomDocKey = roomCode;

  if (!rooms.has(roomDocKey)) {
    rooms.set(roomDocKey, new Y.Doc());
  }

  const yDoc = rooms.get(roomDocKey);

  if (connectionType === 'awareness') {
    const clientID = crypto.randomUUID();

    // Store client info first
    const clientInfo = {
      id: clientID,
      connectedAt: new Date(),
      ip: req.socket.remoteAddress,
      lastActive: Date.now(),
      userName,
      roomCode,
      ws,
      color: userColor
    };

    clients.set(clientID, clientInfo);

    // Setup heartbeat to keep track of active users
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'pong') {
          const client = clients.get(clientID);
          if (client) {
            client.lastActive = Date.now();
          }
        }
      } catch (e) {
        // Ignore parsing errors for non-heartbeat messages
      }
    });

    // Get all users in this room (including the new user since we stored it above)
    const activeUsers = Array.from(clients.values())
      .filter(c => c.roomCode === roomCode)
      .map(c => ({
        clientID: c.id,
        userName: c.userName,
        color: c.color,
        roomCode: c.roomCode
      }));

    // Send to all clients in THIS room only
    wss.clients.forEach((client) => {
      const clientData = Array.from(clients.values()).find(c => c.ws === client);
      if (client.readyState === WebSocket.OPEN && clientData?.roomCode === roomCode) {
        client.send(JSON.stringify({
          type: 'active-users',
          users: activeUsers
        }));
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(clientID);
      // Send updated active users list after user leaves
      const remainingUsers = Array.from(clients.values())
        .filter(c => c.roomCode === roomCode)
        .map(c => ({
          clientID: c.id,
          userName: c.userName,
          color: c.color,
          roomCode: c.roomCode
        }));

      if (remainingUsers.length === 0) {
        scheduleRoomCleanup(roomCode);
      }

      wss.clients.forEach((client) => {
        const clientData = Array.from(clients.values()).find(c => c.ws === client);
        if (client.readyState === WebSocket.OPEN && clientData?.roomCode === roomCode) {
          client.send(JSON.stringify({
            type: 'active-users',
            users: remainingUsers
          }));
        }
      });
    });

    ws.on('error', () => {
      clearInterval(heartbeat);
      ws.close();
    });
  }
  ws.on('error', () => {
    ws.close();
  });

  setupWSConnection(ws, req, {
    doc: yDoc,
    cors: true,
    maxBackoffTime: 2500,
    gc: false
  });
});

const getConnectedClients = () => {
  return Array.from(clients.values()).map(client => ({
    id: client.id,
    connectedAt: client.connectedAt,
    ip: client.ip,
    lastActive: client.lastActive,
    userName: client.userName,
    roomCode: client.roomCode,
    connectionDuration: Date.now() - client.connectedAt
  }));
};

setInterval(() => {
  const activeClients = getConnectedClients();
  console.log('Active clients:', activeClients.length);
}, 600000);

server.listen(port, host, () => {
  console.log(`ArtFreak WebSocket Server is running on ws://${host}:${port}`);
  process.on('SIGINT', () => {
    wss.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });
});

const scheduleRoomCleanup = (roomCode) => {
  // Clear any existing timeout
  if (roomTimeouts.has(roomCode)) {
    clearTimeout(roomTimeouts.get(roomCode));
  }

  // Schedule new cleanup
  const timeout = setTimeout(() => {
    const hasActiveUsers = Array.from(clients.values())
      .some(client => client.roomCode === roomCode);
    
    if (!hasActiveUsers) {
      const doc = rooms.get(roomCode);
      if (doc) doc.destroy(); // Free up Yjs internals
      rooms.delete(roomCode);
      roomTimeouts.delete(roomCode);
      console.log(`Cleaned up inactive room: ${roomCode}`);
    }
  }, ROOM_CLEANUP_DELAY);

  roomTimeouts.set(roomCode, timeout);
};