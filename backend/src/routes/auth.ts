import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

const router = Router();

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function publicUser(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Email and password are required." },
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });

  setRefreshCookie(res, refreshToken);

  res.json({ accessToken, user: publicUser(user) });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({
      error: { code: "NO_REFRESH_TOKEN", message: "No refresh token provided." },
    });
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({
      error: { code: "INVALID_REFRESH_TOKEN", message: "Refresh token is invalid or expired." },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return res.status(401).json({
      error: { code: "USER_NOT_FOUND", message: "User no longer exists." },
    });
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });

  res.json({ accessToken, user: publicUser(user) });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME);
  res.json({ success: true });
});

router.get("/me", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(401).json({
      error: { code: "USER_NOT_FOUND", message: "User no longer exists." },
    });
  }
  res.json({ user: publicUser(user) });
});

export default router;
