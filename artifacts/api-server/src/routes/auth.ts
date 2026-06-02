import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, engineersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../middlewares/auth";

const router = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role, phone }).returning();
    if (role === "engineer") {
      await db.insert(engineersTable).values({
        userId: user.id,
        registryNumber: `KAD-${user.id}-${Date.now()}`,
        specializations: "[]",
        region: "Москва",
        experience: 0,
      });
    }
    const token = signToken({ userId: user.id, role: user.role });
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ user: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null }, token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Missing email or password" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ userId: user.id, role: user.role });
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null }, token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
