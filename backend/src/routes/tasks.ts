import { Router, Response } from "express";
import { TaskStatus, Priority } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireTaskAccess } from "../middleware/ownership";
import { getIO } from "../socket";
import { formatActivityMessage } from "../lib/activityFeed";

const router = Router();

const VALID_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const VALID_PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

router.patch(
  "/:taskId",
  authenticate,
  requireTaskAccess("taskId"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { taskId } = req.params;
    const body = req.body ?? {};

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found." } });
    }

    // Developers may only change status. Everything else is Admin/PM territory.
    const isDeveloper = req.user!.role === "DEVELOPER";
    const allowedFields = isDeveloper
      ? ["status"]
      : ["title", "description", "assignedToId", "priority", "dueDate", "status"];

    const submittedFields = Object.keys(body);
    const disallowed = submittedFields.filter((field) => !allowedFields.includes(field));

    if (isDeveloper && disallowed.length > 0) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Developers can only update task status." },
      });
    }
    if (disallowed.length > 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: `Unknown field(s): ${disallowed.join(", ")}` },
      });
    }

    const data: {
      title?: string;
      description?: string | null;
      assignedToId?: string;
      priority?: Priority;
      dueDate?: Date;
      status?: TaskStatus;
      isOverdue?: boolean;
    } = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim().length === 0) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "title must be a non-empty string." },
        });
      }
      data.title = body.title.trim();
    }

    if (body.description !== undefined) {
      data.description = typeof body.description === "string" ? body.description.trim() : null;
    }

    let reassigned = false;
    if (body.assignedToId !== undefined) {
      const assignee = await prisma.user.findUnique({ where: { id: body.assignedToId } });
      if (!assignee || assignee.role !== "DEVELOPER") {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "assignedToId must reference an existing developer." },
        });
      }
      data.assignedToId = body.assignedToId;
      reassigned = body.assignedToId !== task.assignedToId;
    }

    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority)) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "priority must be one of LOW, MEDIUM, HIGH, CRITICAL." },
        });
      }
      data.priority = body.priority;
    }

    if (body.dueDate !== undefined) {
      const parsed = new Date(body.dueDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "dueDate must be a valid date." },
        });
      }
      data.dueDate = parsed;
    }

    let statusChanged = false;
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "status must be one of TODO, IN_PROGRESS, IN_REVIEW, DONE." },
        });
      }
      if (body.status !== task.status) {
        statusChanged = true;
        data.status = body.status;
        if (body.status === "DONE") {
          data.isOverdue = false;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Provide at least one field to update." },
      });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data,
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });

    // Every status change is persisted with a timestamp and the user who made it,
    // not derived. Then broadcast it live to everyone allowed to see this task's activity.
    if (statusChanged) {
      const activityLog = await prisma.activityLog.create({
        data: {
          taskId,
          userId: req.user!.id,
          fromStatus: task.status,
          toStatus: updated.status,
        },
      });

      const actor = await prisma.user.findUnique({ where: { id: req.user!.id } });
      const payload = {
        id: activityLog.id,
        taskId,
        taskTitle: updated.title,
        userId: req.user!.id,
        userName: actor?.name ?? "Someone",
        fromStatus: activityLog.fromStatus,
        toStatus: activityLog.toStatus,
        createdAt: activityLog.createdAt,
        message: formatActivityMessage({
          userName: actor?.name ?? "Someone",
          taskTitle: updated.title,
          fromStatus: activityLog.fromStatus,
          toStatus: activityLog.toStatus,
          createdAt: activityLog.createdAt,
        }),
      };

      getIO()
        .to("global")
        .to(`project:${updated.projectId}`)
        .to(`user:${updated.assignedToId}`)
        .emit("activity:new", payload);

      // Notify the PM who owns this project when a task moves to In Review.
      if (updated.status === "IN_REVIEW") {
        const project = await prisma.project.findUnique({ where: { id: updated.projectId } });
        if (project) {
          const notification = await prisma.notification.create({
            data: {
              userId: project.createdById,
              taskId,
              type: "TASK_IN_REVIEW",
              message: `"${updated.title}" was moved to In Review`,
            },
          });
          const unreadCount = await prisma.notification.count({
            where: { userId: project.createdById, isRead: false },
          });
          getIO().to(`user:${project.createdById}`).emit("notification:new", { notification, unreadCount });
        }
      }
    }

    // Notify the developer when they're assigned to a task. Reassignment counts too.
    if (reassigned) {
      const notification = await prisma.notification.create({
        data: {
          userId: updated.assignedToId,
          taskId,
          type: "TASK_ASSIGNED",
          message: `You were assigned to "${updated.title}"`,
        },
      });
      const unreadCount = await prisma.notification.count({
        where: { userId: updated.assignedToId, isRead: false },
      });
      getIO().to(`user:${updated.assignedToId}`).emit("notification:new", { notification, unreadCount });
    }

    res.json({ task: updated });
  }
);

export default router;