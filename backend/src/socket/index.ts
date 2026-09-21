import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

interface SocketData {
  user: { id: string; role: string };
}

let io: Server<any, any, any, SocketData> | null = null;

// Tracks which users currently have at least one open socket connection.
// A Map<userId, Set<socketId>> so a user with multiple tabs is still only counted once.
const onlineUsers = new Map<string, Set<string>>();

function addPresence(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

function removePresence(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

export function getOnlineUserCount(): number {
  return onlineUsers.size;
}

/**
 * Room design (deliberately simple):
 * - Every authenticated socket joins a personal room `user:<id>`.
 *   This is used for notifications (any role) and is the Developer's
 *   entire activity-feed scope (their assigned tasks, looked up fresh
 *   from the DB at emit time — no per-task room bookkeeping needed).
 * - Admin additionally joins "global" (sees everything).
 * - PM additionally joins `project:<id>` for each project they own.
 */
export function initSocket(httpServer: HTTPServer): Server<any, any, any, SocketData> {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  io = new Server<any, any, any, SocketData>(httpServer, {
    cors: { origin: frontendOrigin, credentials: true },
  });

  // Authenticate during the handshake, before any room can be joined.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.userId, role: payload.role };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user;

    socket.join(`user:${user.id}`);

    addPresence(user.id, socket.id);
    io!.to("global").emit("presence:update", { onlineCount: getOnlineUserCount() });

    socket.on("disconnect", () => {
      removePresence(user.id, socket.id);
      io!.to("global").emit("presence:update", { onlineCount: getOnlineUserCount() });
    });

    if (user.role === "ADMIN") {
      socket.join("global");
    } else if (user.role === "PM") {
      const projects = await prisma.project.findMany({
        where: { createdById: user.id },
        select: { id: true },
      });
      projects.forEach((p: { id: string }) => socket.join(`project:${p.id}`));
    }
  });

  return io;
}

export function getIO(): Server<any, any, any, SocketData> {
  if (!io) {
    throw new Error("Socket.io has not been initialized yet.");
  }
  return io;
}
