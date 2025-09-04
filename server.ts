import express, { Application } from "express";
import dotenv from "dotenv";
import db from "./db"; // Sequelize instance
import "./src/models/index";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from './app'; // Your main Express app

dotenv.config();

const PORT = process.env.PORT || 3000;

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
  },
});

// Attach io to global to access in services
declare global {
  var io: SocketIOServer;
}
global.io = io;

// Socket.IO connection handler
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} connected to room user_${userId}`);
  }

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// DB Connect & Server Start
const connectDB = async () => {
  try {
    await db.authenticate();
    console.log("Database connected successfully.");
    await db.sync(); // Sync all models
  } catch (error) {
    console.error("Database connection error:", (error as Error).message);
  }
};

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
