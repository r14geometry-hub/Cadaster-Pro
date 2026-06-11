import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, engineersTable, verificationLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../middlewares/auth";
import { rosreestrProvider, computeRatingFromRosreestr } from "../services/rosreestr";

const router = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, attestatNumber } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const ALLOWED_ROLES = ["customer", "engineer"];
    if (!ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ error: "Invalid role. Allowed: customer, engineer" });
      return;
    }

    if (role === "engineer") {
      if (!attestatNumber) {
        res.status(400).json({
          error: "Для регистрации кадастрового инженера необходимо указать номер аттестата Росреестра",
        });
        return;
      }

      const record = await rosreestrProvider.lookupByAttestat(attestatNumber);

      if (!record) {
        res.status(403).json({
          error: "Номер аттестата не найден в реестре Росреестра. Проверьте правильность номера.",
        });
        return;
      }

      if (record.status !== "active") {
        const statusLabel = record.status === "suspended" ? "приостановлен" : "аннулирован";
        res.status(403).json({
          error: `Регистрация невозможна: аттестат кадастрового инженера ${statusLabel}. Для получения доступа необходимо восстановить действующий статус в Росреестре.`,
        });
        return;
      }

      if (record.sroStatus !== "active") {
        res.status(403).json({
          error: `Регистрация невозможна: членство в СРО «${record.sroName}» не является действующим. Ответственность инженера должна быть обеспечена компенсационным фондом действующей СРО.`,
        });
        return;
      }

      const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (existing.length > 0) {
        res.status(400).json({ error: "Email already in use" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role, phone }).returning();

      const worksCount = record.worksCount;
      const rejectionRate = worksCount > 0 ? record.rejectionsCount / worksCount : 0;
      const initialRating = computeRatingFromRosreestr(record);

      const [eng] = await db.insert(engineersTable).values({
        userId: user.id,
        registryNumber: attestatNumber,
        attestatNumber,
        isVerified: true,
        rosreestrStatus: record.status,
        sroName: record.sroName,
        rosreestrCheckedAt: new Date(),
        rosreestrWorksCount: record.worksCount,
        rosreestrRejectionsCount: record.rejectionsCount,
        rosreestrSuspensionsCount: record.suspensionsCount,
        rosreestrRejectionRate: Math.round(rejectionRate * 1000) / 1000,
        rating: initialRating,
        specializations: "[]",
        region: "Москва",
        experience: 0,
      }).returning();

      await db.insert(verificationLogsTable).values({
        engineerId: eng.id,
        attestatNumber,
        result: "pass",
        failureReason: null,
        rawSnapshot: JSON.stringify(record),
      });

      const token = signToken({ userId: user.id, role: user.role });
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json({ user: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null }, token });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role, phone }).returning();
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
