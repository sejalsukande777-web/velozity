import { Router, Response } from "express";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { getRoleScopedActivity } from "../lib/activityFeed";

const router = Router();

router.get("/", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const requestedLimit = parseInt(String(req.query.limit ?? ""), 10);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : undefined;

  const activity = await getRoleScopedActivity({
    userId: req.user!.id,
    role: req.user!.role,
    limit,
  });

  res.json({ activity });
});

export default router;
