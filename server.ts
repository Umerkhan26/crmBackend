import express, { Application } from "express";
import dotenv from "dotenv";
import db from "./db";
import "./src/models/index";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from './app';
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
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(`user_${userId}`);
  }

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const connectDB = async () => {
  try {
    await db.authenticate();
    console.log("Database connected successfully.");
    await db.sync();
  } catch (error) {
    console.error("Database connection error:", (error as Error).message);
  }
};

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
