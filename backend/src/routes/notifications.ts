import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

const router = Router();

router.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  res.json({ notifications, unreadCount });
});

router.patch("/read-all", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });

  res.json({ success: true });
});

router.patch("/:id/read", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.user!.id) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found." } });
  }

  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  res.json({ notification: updated });
});

export default router;
