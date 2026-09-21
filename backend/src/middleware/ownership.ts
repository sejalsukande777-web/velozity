import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "./authenticate";

export async function isProjectOwner(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return !!project && project.createdById === userId;
}

export async function isTaskAssignee(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  return !!task && task.assignedToId === userId;
}

export async function isProjectOwnerOfTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  return !!task && task.project.createdById === userId;
}

/**
 * Requires req.user to own the project identified by req.params[paramName].
 * Admins always pass. Use after authenticate + requireRole("ADMIN", "PM").
 */
export function requireProjectOwnership(paramName = "projectId") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "NOT_AUTHENTICATED", message: "You must be logged in." } });
    }
    if (req.user.role === "ADMIN") return next();

    const owns = await isProjectOwner(req.user.id, req.params[paramName]);
    if (!owns) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not own this project." } });
    }
    next();
  };
}

/**
 * Requires req.user to have access to the task identified by req.params[paramName]:
 * - Admin: always
 * - PM: only if they own the task's project
 * - Developer: only if the task is assigned to them
 */
export function requireTaskAccess(paramName = "taskId") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "NOT_AUTHENTICATED", message: "You must be logged in." } });
    }
    if (req.user.role === "ADMIN") return next();

    const taskId = req.params[paramName];

    if (req.user.role === "PM") {
      const owns = await isProjectOwnerOfTask(req.user.id, taskId);
      if (!owns) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not manage this task's project." } });
      }
      return next();
    }

    const assigned = await isTaskAssignee(req.user.id, taskId);
    if (!assigned) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "This task is not assigned to you." } });
    }
    next();
  };
}
