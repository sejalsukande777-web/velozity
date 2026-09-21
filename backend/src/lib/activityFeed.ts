import { prisma } from "./prisma";

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export function prettyStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatActivityMessage(params: {
  userName: string;
  taskTitle: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: Date;
}): string {
  const { userName, taskTitle, fromStatus, toStatus, createdAt } = params;
  const timeAgo = formatRelativeTime(createdAt);

  if (!fromStatus) {
    return `${userName} created "${taskTitle}" (${prettyStatus(toStatus)}) · ${timeAgo}`;
  }

  return `${userName} moved "${taskTitle}" from ${prettyStatus(fromStatus)} → ${prettyStatus(toStatus)} · ${timeAgo}`;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Fetches activity log entries scoped to what this user/role is allowed to see:
 * - ADMIN: every entry (global feed)
 * - PM: only entries for tasks inside projects they created
 * - DEVELOPER: only entries for tasks assigned to them
 *
 * Shared by the GET /activity route and the socket reconnect/catchup logic,
 * so both stay in sync with a single source of truth.
 */
export async function getRoleScopedActivity(params: { userId: string; role: string; limit?: number }) {
  const { userId, role } = params;
  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, MAX_LIMIT) : DEFAULT_LIMIT;

  let where = {};
  if (role === "PM") {
    where = { task: { project: { createdById: userId } } };
  } else if (role === "DEVELOPER") {
    where = { task: { assignedToId: userId } };
  }
  // ADMIN: no filter

  const logs = await prisma.activityLog.findMany({
    where,
    include: {
      task: { select: { id: true, title: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((log: any) => ({
    id: log.id,
    taskId: log.taskId,
    taskTitle: log.task.title,
    userId: log.userId,
    userName: log.user.name,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    createdAt: log.createdAt,
    message: formatActivityMessage({
      userName: log.user.name,
      taskTitle: log.task.title,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      createdAt: log.createdAt,
    }),
  }));
}
