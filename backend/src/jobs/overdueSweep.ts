import cron from "node-cron";
import { prisma } from "../lib/prisma";

/**
 * Flags tasks as overdue when their due date has passed and they aren't
 * already Done. Runs as a scheduled background sweep so overdue status
 * doesn't need to be recalculated on every page load.
 */
export async function runOverdueSweep(): Promise<number> {
  const result = await prisma.task.updateMany({
    where: {
      dueDate: { lt: new Date() },
      status: { not: "DONE" },
      isOverdue: false,
    },
    data: { isOverdue: true },
  });

  return result.count;
}

export function scheduleOverdueSweep(): void {
  // Run once on startup too, so tasks that became overdue while the server
  // was down get caught immediately rather than waiting for the next tick.
  runOverdueSweep().catch((err) => console.error("Overdue sweep failed:", err));

  cron.schedule("*/5 * * * *", () => {
    runOverdueSweep().catch((err) => console.error("Overdue sweep failed:", err));
  });
}
