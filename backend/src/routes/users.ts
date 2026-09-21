import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const VALID_ROLES = ["ADMIN", "PM", "DEVELOPER"];

router.get("/", authenticate, requireRole("ADMIN", "PM"), async (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.query;

  const where: Record<string, string> = {};
  if (typeof role === "string" && VALID_ROLES.includes(role)) {
    where.role = role;
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  res.json({ users });
});

export default router;
