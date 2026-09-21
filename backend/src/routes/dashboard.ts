import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { getOnlineUserCount } from "../socket";

const router = Router();

router.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { role, id: userId } = req.user!;

  if (role === "ADMIN") {
    const [totalProjects, statusGroups, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.task.count({ where: { isOverdue: true } }),
    ]);

    const tasksByStatus: Record<string, number> = {};
    statusGroups.forEach((g: any) => {
      tasksByStatus[g.status] = g._count._all;
    });

    return res.json({
      role: "ADMIN",
      totalProjects,
      tasksByStatus,
      overdueCount,
      onlineUserCount: getOnlineUserCount(),
    });
  }

  if (role === "PM") {
    const projects = await prisma.project.findMany({
      where: { createdById: userId },
      include: { tasks: true },
    });

    const allTasks = projects.flatMap((p: any) => p.tasks);

    const tasksByPriority: Record<string, number> = {};
    allTasks.forEach((t: any) => {
      tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
    });

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = allTasks
      .filter((t: any) => t.status !== "DONE" && t.dueDate >= now && t.dueDate <= weekFromNow)
      .map((t: any) => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority }));

    return res.json({
      role: "PM",
      projectsSummary: projects.map((p: any) => ({ id: p.id, name: p.name, taskCount: p.tasks.length })),
      tasksByPriority,
      dueThisWeek,
    });
  }

  // DEVELOPER: assigned tasks, highest priority first, soonest due date first within a priority
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  res.json({
    role: "DEVELOPER",
    tasks: tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      isOverdue: t.isOverdue,
    })),
  });
});

export default router;
