import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAgentHandler } from './api/index.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Create AG-UI handler
const agentHandler = createAgentHandler();

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:5173', 'http://localhost:3000']
        : process.env.CLIENT_URL || false,
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'AI App Generator Server',
        version: '1.0.0'
    });
});

// Agent info endpoint
app.get('/agent/info', (req, res) => {
    res.json({
        name: 'AI App Generator',
        description: 'Generate web applications through natural language interactions',
        capabilities: ['initial-app-generation', 'app-modification', 'wireframe-creation'],
        protocol: 'AG-UI',
        version: '1.0.0'
    });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log(`🔗 New WebSocket connection from ${req.socket.remoteAddress}`);
    
    // Use the simplified handler
    agentHandler.handleConnection(ws);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, () => {
    console.log('🚀 AI App Generator Server started');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
