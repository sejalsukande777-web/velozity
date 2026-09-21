import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import projectRoutes from "./routes/projects";
import projectTasksRoutes from "./routes/projectTasks";
import taskRoutes from "./routes/tasks";
import activityRoutes from "./routes/activity";
import notificationRoutes from "./routes/notifications";
import dashboardRoutes from "./routes/dashboard";
import userRoutes from "./routes/users";
import { initSocket } from "./socket";
import { scheduleOverdueSweep } from "./jobs/overdueSweep";

const app = express();
const port = process.env.PORT || 4000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/clients", clientRoutes);
app.use("/projects", projectRoutes);
app.use("/projects/:projectId/tasks", projectTasksRoutes);
app.use("/tasks", taskRoutes);
app.use("/activity", activityRoutes);
app.use("/notifications", notificationRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/users", userRoutes);

const httpServer = createServer(app);
initSocket(httpServer);
scheduleOverdueSweep();

httpServer.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
