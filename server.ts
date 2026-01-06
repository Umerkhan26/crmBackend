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
    
    // Drop existing foreign key constraint for campaignId if it exists
    // Try common constraint names that Sequelize might use
    const possibleConstraintNames = [
      'product_sales_ibfk_1',
      'product_sales_ibfk_2',
      'product_sales_ibfk_3',
      'product_sales_ibfk_4',
      'product_sales_campaignId_fkey',
      'product_sales_ibfk_campaignId',
    ];
    
    for (const constraintName of possibleConstraintNames) {
      try {
        await db.query(`ALTER TABLE product_sales DROP FOREIGN KEY ${constraintName}`);
        console.log(`✅ Dropped existing foreign key constraint: ${constraintName}`);
        break; // If successful, stop trying
      } catch (fkError: any) {
        // Continue to next constraint name if this one doesn't exist
        continue;
      }
    }
    
    // Also try to get constraint name from SHOW CREATE TABLE
    try {
      const [createTableResults]: any = await db.query(`SHOW CREATE TABLE product_sales`);
      if (createTableResults && createTableResults.length > 0) {
        const createTableSql = createTableResults[0]['Create Table'];
        // Extract foreign key constraint names from the CREATE TABLE statement
        const fkMatches = createTableSql.match(/CONSTRAINT `([^`]+)` FOREIGN KEY \(`campaignId`\)/g);
        if (fkMatches) {
          for (const match of fkMatches) {
            const constraintMatch = match.match(/CONSTRAINT `([^`]+)`/);
            if (constraintMatch) {
              const constraintName = constraintMatch[1];
              try {
                await db.query(`ALTER TABLE product_sales DROP FOREIGN KEY \`${constraintName}\``);
                console.log(`✅ Dropped existing foreign key constraint: ${constraintName}`);
              } catch (e) {
                // Ignore if already dropped
              }
            }
          }
        }
      }
    } catch (showError: any) {
      // Table might not exist yet, which is fine
      console.log("ℹ️  Table might not exist yet (this is OK)");
    }
    
    await db.sync({ alter: true });
    console.log("Database synced.");
  } catch (error) {
    console.error("Database connection error:", (error as Error).message);
  }
};

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
