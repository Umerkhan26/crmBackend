import dotenv from "dotenv";
import db from "./db";
import "./src/models/index";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app, { loadRoutes } from './app';
dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
  },
});

declare global {
  var io: SocketIOServer;
}
global.io = io;

io.on("connection", (socket) => {
  const raw = socket.handshake.query.userId;
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (userId != null && String(userId).trim() !== "") {
    socket.join(`user_${String(userId).trim()}`);
  }

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const startServer = async () => {
  try {
    // Connect to database
    await db.authenticate();
    console.log("✅ Database connected successfully.");

    // Load routes
    loadRoutes(app);
    console.log("✅ Routes loaded.");

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup error:", (error as Error).message);
    process.exit(1);
  }
};

startServer();
