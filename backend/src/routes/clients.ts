import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/", authenticate, requireRole("ADMIN", "PM"), async (_req: AuthenticatedRequest, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json({ clients });
});

router.post("/", authenticate, requireRole("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  const { name, contactInfo } = req.body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Client name is required." },
    });
  }

  const client = await prisma.client.create({
    data: {
      name: name.trim(),
      contactInfo: typeof contactInfo === "string" ? contactInfo.trim() : null,
    },
  });

  res.status(201).json({ client });
});

export default router;
