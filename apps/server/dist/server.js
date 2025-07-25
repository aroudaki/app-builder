"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_js_1 = require("./api/index.js");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:5173', 'http://localhost:3000']
        : process.env.CLIENT_URL || false,
    credentials: true
}));
app.use(express_1.default.json());
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection established');
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await (0, index_js_1.handleWebSocketMessage)(ws, message);
        }
        catch (error) {
            console.error('Error handling WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'ERROR',
                payload: {
                    message: 'Failed to process message',
                    recoverable: false
                }
            }));
        }
    });
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});
// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map