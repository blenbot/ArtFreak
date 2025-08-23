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
    
    const recentConnections = history.filter(ts => now - ts < this.windowMs);
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
    .replace(/[<>]/g, '') 
    .trim()
    .slice(0, 16);
};

const clients = new Map();
const rooms = new Map();
const ROOM_CLEANUP_DELAY = 10 * 60 * 1000;
const roomTimeouts = new Map();
const WSrateLimiter = new RateLimiter(5000, 30);
const httpRateLimiter = new RateLimiter(5000, 15);

setInterval(() => WSrateLimiter.cleanup(), 10000);
setInterval(() => httpRateLimiter.cleanup(), 10000);

const INACTIVE_TIMEOUT = 10 * 60 * 1000;
const HEARTBEAT_INTERVAL = 30 * 1000;

// Fixed CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS request from origin:', origin);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = environment === 'production' 
      ? [
          'https://art-freakk.vercel.app', // Fixed: removed trailing slash
          'https://www.art-freakk.vercel.app',
          /^https:\/\/art-freakk.*\.vercel\.app$/, // Match all your Vercel deployments
          /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel deployments for testing
        ] 
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          /^http:\/\/localhost:\d+$/,
          /^http:\/\/127\.0\.0\.1:\d+$/,
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Local network range
        ];

    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      return allowed.test(origin);
    });

    console.log('Origin allowed:', isAllowed);
    callback(null, isAllowed);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'X-Custom-Header',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Methods'
  ],
  credentials: false, // Set to false to avoid credential issues
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200,
  preflightContinue: false
};

setInterval(() => {
  const now = Date.now();
  for (const [clientId, client] of clients.entries()) {
    if (now - client.lastActive > INACTIVE_TIMEOUT) {
      console.log(`Cleaning up inactive user ${client.userName} in room ${client.roomCode}`);
      client.ws.close(1000, 'Inactive timeout');
      clients.delete(clientId);

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

// Apply CORS middleware
const corsMiddleware = cors(corsOptions);

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress;
  
  console.log(`${req.method} ${req.url} from ${ip} (Origin: ${req.headers.origin})`);

  // Apply CORS first
  corsMiddleware(req, res, () => {
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Vary', 'Origin, Accept-Encoding');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    // Handle preflight requests explicitly
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      res.writeHead(200);
      res.end();
      return;
    }

    // Rate limiting
    if (httpRateLimiter.isRateLimited(ip)) {
      console.warn(`Rate limited ${ip}`);
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Rate limited',
        message: 'Too many requests. Please try again later.',
        retryAfter: 5
      }));
      return;
    }

    // Enhanced health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'ArtFreak WebSocket Server',
        version: '1.2.0',
        activeConnections: wss ? wss.clients.size : 0,
        activeRooms: rooms.size,
        environment: environment,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        mobileOptimized: true,
        cors: 'enabled'
      }));
      return;
    }

    // Create room endpoint
    if (req.url === '/create-room' && req.method === 'GET') {
      try {
        let roomCode;
        let attempts = 0;
        do {
          roomCode = crypto.randomUUID().slice(0, 6).toUpperCase();
          attempts++;
        } while (rooms.has(roomCode) && attempts < 10);

        if (attempts >= 10) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Unable to generate unique room code',
            message: 'Please try again'
          }));
          return;
        }

        // Pre-create the room
        rooms.set(roomCode, new Y.Doc());
        
        console.log(`Created room: ${roomCode} from IP: ${ip}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          roomCode,
          status: 'success',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Error creating room:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Internal server error',
          message: 'Failed to create room. Please try again.'
        }));
      }
      return;
    }

    // Check room endpoint
    if (req.url.startsWith('/check-room') && req.method === 'GET') {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const roomCode = url.searchParams.get('roomCode');
        
        if (!roomCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Missing room code',
            exists: false
          }));
          return;
        }

        const exists = rooms.has(roomCode);
        
        console.log(`Room check: ${roomCode} - exists: ${exists}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          exists,
          roomCode: exists ? roomCode : null,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Error checking room:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Internal server error',
          exists: false
        }));
      }
      return;
    }

    // Default response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`ArtFreak WebSocket Server v1.2.0
CORS Fixed & Mobile Network Optimized
Status: Running
Environment: ${environment}
Timestamp: ${new Date().toISOString()}
`);
  });
});

// Enhanced WebSocket server configuration
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 6,
      level: 2
    },
    zlibInflateOptions: {
      chunkSize: 8 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 9,
    concurrencyLimit: 5,
    threshold: 512
  },
  maxPayload: 32 * 1024,
  skipUTF8Validation: true,
  handshakeTimeout: 10000,
  backlogSize: 100,
  noServer: false
});

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  if (WSrateLimiter.isRateLimited(ip)) {
    console.warn(`WS rate limited ${ip}`);
    ws.close(1008, 'Rate limited');
    return;
  }

  ws.binaryType = 'arraybuffer';
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('ping', () => {
    ws.pong();
  });

  const url = new URL(req.url, `ws://${req.headers.host}`);
  const roomCode = url.searchParams.get('room');
  const connectionType = url.searchParams.get('type')?.split('/')[0];
  const userName = sanitizeInput(url.searchParams.get('username')?.split('/')[0]) || `User-${Math.floor(Math.random() * 1000)}`;
  const userColor = /^#[0-9A-F]{6}$/i.test(url.searchParams.get('color')) 
    ? url.searchParams.get('color')
    : `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;

  if (!roomCode) {
    ws.close(1000, 'No room code provided');
    return;
  }

  const roomDocKey = roomCode;

  if (!rooms.has(roomDocKey)) {
    rooms.set(roomDocKey, new Y.Doc());
  }

  const yDoc = rooms.get(roomDocKey);

  if (connectionType === 'awareness') {
    const clientID = crypto.randomUUID();
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

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping(Buffer.from('heartbeat'));
        } catch (error) {
          console.log('Heartbeat failed, closing connection');
          clearInterval(heartbeat);
          ws.close();
        }
      } else {
        clearInterval(heartbeat);
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
        // Ignore non-JSON messages
      }
    });

    const activeUsers = Array.from(clients.values())
      .filter(c => c.roomCode === roomCode)
      .map(c => ({
        clientID: c.id,
        userName: c.userName,
        color: c.color,
        roomCode: c.roomCode
      }));

    wss.clients.forEach((client) => {
      const clientData = Array.from(clients.values()).find(c => c.ws === client);
      if (client.readyState === WebSocket.OPEN && clientData?.roomCode === roomCode) {
        try {
          client.send(JSON.stringify({
            type: 'active-users',
            users: activeUsers
          }));
        } catch (error) {
          console.log('Failed to send active users update');
        }
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(clientID);
      
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
          try {
            client.send(JSON.stringify({
              type: 'active-users',
              users: remainingUsers
            }));
          } catch (error) {
            console.log('Failed to send user leave update');
          }
        }
      });
    });

    ws.on('error', (error) => {
      console.log('WebSocket error:', error.message);
      clearInterval(heartbeat);
      ws.close();
    });
  }
  
  ws.on('error', (error) => {
    console.log('WebSocket error:', error.message);
    ws.close();
  });

  setupWSConnection(ws, req, {
    doc: yDoc,
    cors: true,
    maxBackoffTime: 5000,
    gc: false
  });
});

// Ping/pong for connection health
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating inactive connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    try {
      ws.ping(Buffer.from('server-ping'));
    } catch (error) {
      console.log('Ping failed, terminating connection');
      ws.terminate();
    }
  });
}, 25000);

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
  console.log(`[${new Date().toISOString()}] Active clients: ${activeClients.length}, Rooms: ${rooms.size}`);
}, 300000);

server.listen(port, host, () => {
  console.log(`ArtFreak WebSocket Server v1.2.0 running on ws://${host}:${port}`);
  console.log('CORS fixed and mobile network optimizations: ENABLED');
  console.log('Environment:', environment);
  console.log('Allowed origins:', JSON.stringify(corsOptions.origin.toString()));
  
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    clearInterval(pingInterval);
    wss.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    clearInterval(pingInterval);
    wss.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });
});

const scheduleRoomCleanup = (roomCode) => {
  if (roomTimeouts.has(roomCode)) {
    clearTimeout(roomTimeouts.get(roomCode));
  }

  const timeout = setTimeout(() => {
    const hasActiveUsers = Array.from(clients.values())
      .some(client => client.roomCode === roomCode);
    
    if (!hasActiveUsers) {
      const doc = rooms.get(roomCode);
      if (doc) doc.destroy();
      rooms.delete(roomCode);
      roomTimeouts.delete(roomCode);
      console.log(`Cleaned up inactive room: ${roomCode}`);
    }
  }, ROOM_CLEANUP_DELAY);

  roomTimeouts.set(roomCode, timeout);
};