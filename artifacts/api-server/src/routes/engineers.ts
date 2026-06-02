import { Router } from "express";
import { db, usersTable, engineersTable } from "@workspace/db";
import { eq, and, gte, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function parseSpecializations(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

async function formatEngineer(eng: typeof engineersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
  const { passwordHash: _, ...safeUser } = user;
  return {
    ...eng,
    user: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null },
    specializations: parseSpecializations(eng.specializations),
    bio: eng.bio ?? null,
  };
}

router.get("/engineers", async (req, res) => {
  try {
    const { region, specialization, minRating, search, page = "1", limit = "12" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(engineersTable).$dynamic();

    const conditions = [];
    if (region) conditions.push(eq(engineersTable.region, region));
    if (minRating) conditions.push(gte(engineersTable.rating, parseFloat(minRating)));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const all = await query.orderBy(sql`${engineersTable.rating} desc`).limit(limitNum).offset(offset);

    let results = await Promise.all(all.map(formatEngineer));

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(e =>
        e.user.name.toLowerCase().includes(s) ||
        e.region.toLowerCase().includes(s) ||
        e.specializations.some((sp: string) => sp.toLowerCase().includes(s))
      );
    }

    if (specialization) {
      results = results.filter(e => e.specializations.includes(specialization));
    }

    const total = results.length;
    res.json({ items: results, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/top", async (req, res) => {
  try {
    const all = await db.select().from(engineersTable)
      .orderBy(sql`${engineersTable.rating} desc`)
      .limit(6);
    const results = await Promise.all(all.map(formatEngineer));
    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/me", requireAuth, async (req, res) => {
  try {
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }
    res.json(await formatEngineer(eng));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/engineers/me", requireAuth, async (req, res) => {
  try {
    const { specializations, region, experience, bio, phone } = req.body;
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }
    const updates: Record<string, unknown> = {};
    if (specializations !== undefined) updates.specializations = JSON.stringify(specializations);
    if (region !== undefined) updates.region = region;
    if (experience !== undefined) updates.experience = experience;
    if (bio !== undefined) updates.bio = bio;
    const [updated] = await db.update(engineersTable).set(updates).where(eq(engineersTable.id, eng.id)).returning();
    if (phone !== undefined) {
      await db.update(usersTable).set({ phone }).where(eq(usersTable.id, req.user!.userId));
    }
    res.json(await formatEngineer(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/engineers/verify", requireAuth, async (req, res) => {
  try {
    const { registryNumber } = req.body;
    if (!registryNumber) { res.status(400).json({ error: "registryNumber required" }); return; }
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);

    const isValid = registryNumber.length >= 5;
    if (isValid && eng) {
      await db.update(engineersTable).set({ registryNumber, isVerified: true }).where(eq(engineersTable.id, eng.id));
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json({ isValid, engineerName: isValid ? user.name : null, message: isValid ? "Номер подтверждён" : "Номер не найден в реестре" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId", async (req, res) => {
  try {
    const id = parseInt(req.params.engineerId);
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, id)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }
    res.json(await formatEngineer(eng));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
