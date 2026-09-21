import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { requireProjectOwnership } from "../middleware/ownership";
import { getIO } from "../socket";

const router = Router({ mergeParams: true });

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "PM"),
  requireProjectOwnership("projectId"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const { status, priority, dueFrom, dueTo } = req.query;

    const where: Record<string, any> = { projectId };

    if (typeof status === "string" && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (typeof priority === "string" && VALID_PRIORITIES.includes(priority)) {
      where.priority = priority;
    }
    if (typeof dueFrom === "string" || typeof dueTo === "string") {
      const dueDateFilter: Record<string, Date> = {};
      if (typeof dueFrom === "string") {
        const parsed = new Date(dueFrom);
        if (!isNaN(parsed.getTime())) dueDateFilter.gte = parsed;
      }
      if (typeof dueTo === "string") {
        const parsed = new Date(dueTo);
        if (!isNaN(parsed.getTime())) dueDateFilter.lte = parsed;
      }
      if (Object.keys(dueDateFilter).length > 0) where.dueDate = dueDateFilter;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ tasks });
  }
);

router.post(
  "/",
  authenticate,
  requireRole("ADMIN", "PM"),
  requireProjectOwnership("projectId"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const { title, description, assignedToId, priority, dueDate } = req.body ?? {};

    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Task title is required." },
      });
    }
    if (typeof assignedToId !== "string" || assignedToId.trim().length === 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "assignedToId is required." },
      });
    }

    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee || assignee.role !== "DEVELOPER") {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "assignedToId must reference an existing developer." },
      });
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "priority must be one of LOW, MEDIUM, HIGH, CRITICAL." },
      });
    }

    const parsedDueDate = new Date(dueDate);
    if (!dueDate || isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "A valid dueDate is required." },
      });
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title: title.trim(),
        description: typeof description === "string" ? description.trim() : null,
        assignedToId,
        priority: priority || "MEDIUM",
        dueDate: parsedDueDate,
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: assignedToId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `You were assigned to "${task.title}"`,
      },
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: assignedToId, isRead: false },
    });
    getIO().to(`user:${assignedToId}`).emit("notification:new", { notification, unreadCount });

    res.status(201).json({ task });
  }
);

export default router;
