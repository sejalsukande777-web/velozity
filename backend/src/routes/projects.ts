import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { requireProjectOwnership } from "../middleware/ownership";

const router = Router();

// Admin sees every project. PM sees only projects they created.
router.get("/", authenticate, requireRole("ADMIN", "PM"), async (req: AuthenticatedRequest, res: Response) => {
  const where = req.user!.role === "PM" ? { createdById: req.user!.id } : {};

  const projects = await prisma.project.findMany({
    where,
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ projects });
});

router.post("/", authenticate, requireRole("ADMIN", "PM"), async (req: AuthenticatedRequest, res: Response) => {
  const { name, clientId } = req.body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Project name is required." },
    });
  }
  if (typeof clientId !== "string" || clientId.trim().length === 0) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "clientId is required." },
    });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "clientId does not match an existing client." },
    });
  }

  const project = await prisma.project.create({
    data: { name: name.trim(), clientId, createdById: req.user!.id },
    include: { client: true },
  });

  res.status(201).json({ project });
});

// requireProjectOwnership lets Admin through always; PM only if they created this project.
router.patch(
  "/:projectId",
  authenticate,
  requireRole("ADMIN", "PM"),
  requireProjectOwnership("projectId"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const { name, clientId } = req.body ?? {};

    const data: { name?: string; clientId?: string } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "name must be a non-empty string." },
        });
      }
      data.name = name.trim();
    }

    if (clientId !== undefined) {
      if (typeof clientId !== "string" || clientId.trim().length === 0) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "clientId must be a non-empty string." },
        });
      }
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "clientId does not match an existing client." },
        });
      }
      data.clientId = clientId;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Provide at least one field to update." },
      });
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
      include: { client: true },
    });

    res.json({ project });
  }
);

export default router;
