import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, leadsTable, bidsTable, leadPricesTable, profileBoostsTable, platformSettingsTable, verificationLogsTable, complaintsTable, chatRoomsTable, chatAttachmentsTable, messagesTable, reviewsTable, notificationsTable, regionsTable } from "@workspace/db";
import { eq, and, sql, gte, desc, or, isNull, lt } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { rosreestrProvider, computeRatingFromRosreestr } from "../services/rosreestr";
import { calculateWeightedRating } from "./reviews";
import { getDistrictFromAttestat } from "../utils/attestat-district";

const router = Router();

const ADMIN_ROLES = ["admin", "superadmin"];

function parseJson(s: string): unknown[] {
  try { return JSON.parse(s); } catch { return []; }
}

router.get("/admin/stats", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [{ total: totalUsers }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable);
    const [{ total: totalEngineers }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable);
    const [{ total: totalCustomers }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "customer"));
    const [{ total: totalOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable);
    const [{ total: openOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable).where(sql`${ordersTable.status} IN ('new', 'open', 'collecting_responses')`);
    const [{ total: completedOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "completed"));
    const [{ total: verifiedEngineers }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable).where(eq(engineersTable.isVerified, true));
    const [{ total: pendingReviews }] = await db.select({ total: sql<number>`count(*)` }).from(reviewsTable).where(eq(reviewsTable.moderationStatus, "pending"));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [{ total: newUsersThisMonth }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.createdAt} >= ${monthStart.toISOString()}`);
    const [{ total: totalDebt }] = await db.select({ total: sql<number>`coalesce(sum(lead_cost), 0)` }).from(leadsTable).where(eq(leadsTable.paymentStatus, "unpaid"));
    const [{ total: needsReverification }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(engineersTable)
      .where(
        and(
          eq(engineersTable.isVerified, true),
          or(isNull(engineersTable.rosreestrCheckedAt), lt(engineersTable.rosreestrCheckedAt, thirtyDaysAgo))
        )
      );
    res.json({
      totalUsers: Number(totalUsers),
      totalEngineers: Number(totalEngineers),
      totalCustomers: Number(totalCustomers),
      totalOrders: Number(totalOrders),
      openOrders: Number(openOrders),
      completedOrders: Number(completedOrders),
      verifiedEngineers: Number(verifiedEngineers),
      pendingReviews: Number(pendingReviews),
      totalRevenue: Number(totalDebt),
      newUsersThisMonth: Number(newUsersThisMonth),
      needsReverification: Number(needsReverification),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/users", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { role, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;
    let query = db.select().from(usersTable).$dynamic();
    if (role) query = query.where(eq(usersTable.role, role));
    const all = await query.orderBy(sql`${usersTable.createdAt} desc`).limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable);
    const items = all.map(({ passwordHash: _, ...u }) => ({ ...u, phone: u.phone ?? null, avatarUrl: u.avatarUrl ?? null }));
    res.json({ items, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/users/:userId", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const { isBlocked } = req.body;
    const updates: Record<string, unknown> = {};
    if (isBlocked !== undefined) updates.isBlocked = isBlocked ? "true" : "false";
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    const { passwordHash: _, ...safe } = updated;
    res.json({ ...safe, phone: safe.phone ?? null, avatarUrl: safe.avatarUrl ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Superadmin-only: change user role
router.put("/admin/users/:userId/role", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const { role } = req.body;
    const allowed = ["customer", "engineer", "admin", "superadmin"];
    if (!role || !allowed.includes(role)) {
      res.status(400).json({ error: "Invalid role" }); return;
    }
    const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId)).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    const { passwordHash: _, ...safe } = updated;
    res.json({ ...safe, phone: safe.phone ?? null, avatarUrl: safe.avatarUrl ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/orders", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;
    let query = db.select().from(ordersTable).$dynamic();
    if (status) query = query.where(eq(ordersTable.status, status));
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable);
    const all = await query.orderBy(sql`${ordersTable.createdAt} desc`).limit(limit).offset(offset);
    const items = all.map(o => ({ ...o, budget: o.budget ?? null, deadline: o.deadline ?? null }));
    res.json({ items, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Platform Settings ─────────────────────────────────────────────────────────

router.get("/admin/settings", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const rows = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.key);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/settings", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { settings } = req.body as { settings: Record<string, string> };
    if (!settings || typeof settings !== "object") {
      res.status(400).json({ error: "settings object required" }); return;
    }
    for (const [key, value] of Object.entries(settings)) {
      await db.insert(platformSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    const rows = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.key);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Lead Prices ──────────────────────────────────────────────────────────────

router.get("/admin/lead-prices", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const prices = await db.select().from(leadPricesTable).orderBy(leadPricesTable.serviceType);
    res.json(prices);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/lead-prices", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { prices } = req.body as { prices: Array<{ serviceType: string; price: number }> };
    if (!Array.isArray(prices)) { res.status(400).json({ error: "prices array required" }); return; }

    const updated = [];
    for (const { serviceType, price } of prices) {
      const [row] = await db.insert(leadPricesTable)
        .values({ serviceType, price })
        .onConflictDoUpdate({ target: leadPricesTable.serviceType, set: { price, updatedAt: new Date() } })
        .returning();
      updated.push(row);
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Leads Management ──────────────────────────────────────────────────────────

router.get("/admin/leads", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { engineerId, paymentStatus, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 30;
    const offset = (pageNum - 1) * limit;

    let query = db.select().from(leadsTable).$dynamic();
    const conditions = [];
    if (engineerId) conditions.push(eq(leadsTable.engineerId, parseInt(engineerId)));
    if (paymentStatus) conditions.push(eq(leadsTable.paymentStatus, paymentStatus));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const all = await query.orderBy(sql`${leadsTable.createdAt} desc`).limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(leadsTable);

    const enriched = await Promise.all(all.map(async (lead) => {
      const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, lead.engineerId)).limit(1);
      const [user] = eng ? await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1) : [null];
      return { ...lead, engineerName: user?.name ?? "—" };
    }));

    res.json({ items: enriched, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/leads/:leadId", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId as string);
    const { paymentStatus } = req.body;
    if (!paymentStatus) { res.status(400).json({ error: "paymentStatus required" }); return; }

    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

    const [updated] = await db.update(leadsTable)
      .set({ paymentStatus })
      .where(eq(leadsTable.id, leadId))
      .returning();

    if (paymentStatus === "paid" && lead.paymentStatus === "unpaid") {
      await db.update(engineersTable)
        .set({ debtAmount: sql`greatest(0, ${engineersTable.debtAmount} - ${lead.leadCost})` })
        .where(eq(engineersTable.id, lead.engineerId));
    } else if (paymentStatus === "unpaid" && lead.paymentStatus === "paid") {
      await db.update(engineersTable)
        .set({ debtAmount: sql`${engineersTable.debtAmount} + ${lead.leadCost}` })
        .where(eq(engineersTable.id, lead.engineerId));
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/leads/summary", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const engineers = await db.select().from(engineersTable).orderBy(sql`${engineersTable.debtAmount} desc`);
    const summary = await Promise.all(engineers.map(async (eng) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
      const allLeads = await db.select().from(leadsTable).where(eq(leadsTable.engineerId, eng.id));
      const totalAccrued = allLeads.reduce((s, l) => s + l.leadCost, 0);
      const totalPaid = allLeads.filter(l => l.paymentStatus === "paid").reduce((s, l) => s + l.leadCost, 0);
      return {
        engineerId: eng.id,
        engineerName: user?.name ?? "—",
        debtAmount: eng.debtAmount ?? 0,
        totalAccrued,
        totalPaid,
        leadCount: allLeads.length,
      };
    }));
    res.json(summary.filter(s => s.totalAccrued > 0));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PRO & Boost controls ──────────────────────────────────────────────────────

router.get("/admin/engineers", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    const engineers = await db.select().from(engineersTable)
      .orderBy(sql`${engineersTable.createdAt} desc`)
      .limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable);

    const now = new Date();
    const activeBoosts = await db.select().from(profileBoostsTable).where(gte(profileBoostsTable.expiresAt, now));
    const boostMap = new Map(activeBoosts.map(b => [b.engineerId, b]));

    const items = await Promise.all(engineers.map(async (eng) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
      return {
        id: eng.id,
        userId: eng.userId,
        name: user?.name ?? "—",
        email: user?.email ?? "—",
        region: eng.region,
        rating: eng.rating,
        isVerified: eng.isVerified,
        isHidden: eng.isHidden ?? false,
        isPro: eng.isPro,
        proExpiresAt: eng.proExpiresAt ?? null,
        debtAmount: eng.debtAmount ?? 0,
        sroName: eng.sroName ?? null,
        attestatNumber: eng.attestatNumber ?? null,
        rosreestrRejectionRate: eng.rosreestrRejectionRate ?? null,
        specializations: parseJson(eng.specializations) as string[],
        activeBoost: boostMap.get(eng.id) ?? null,
      };
    }));

    res.json({ items, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/engineers/:engineerId", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId as string);
    const { isPro, proExpiresAt, boostPeriod, isHidden } = req.body;

    const updates: Record<string, unknown> = {};
    if (isPro !== undefined) updates.isPro = isPro;
    if (proExpiresAt !== undefined) updates.proExpiresAt = proExpiresAt ? new Date(proExpiresAt) : null;
    if (isHidden !== undefined) updates.isHidden = isHidden;

    if (Object.keys(updates).length > 0) {
      await db.update(engineersTable).set(updates).where(eq(engineersTable.id, engineerId));
    }

    if (boostPeriod) {
      const days = parseInt(boostPeriod);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      await db.insert(profileBoostsTable).values({ engineerId, period: days, expiresAt });
    }

    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, engineerId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
    const now = new Date();
    const activeBoosts = await db.select().from(profileBoostsTable)
      .where(and(eq(profileBoostsTable.engineerId, engineerId), gte(profileBoostsTable.expiresAt, now)));

    res.json({
      id: eng.id,
      name: user?.name ?? "—",
      isPro: eng.isPro,
      isHidden: eng.isHidden ?? false,
      proExpiresAt: eng.proExpiresAt ?? null,
      debtAmount: eng.debtAmount ?? 0,
      activeBoost: activeBoosts[activeBoosts.length - 1] ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Hide/show engineer profile
router.patch("/admin/engineers/:engineerId/visibility", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId as string);
    const { isHidden } = req.body;
    if (isHidden === undefined) { res.status(400).json({ error: "isHidden required" }); return; }

    const [eng] = await db.update(engineersTable)
      .set({ isHidden })
      .where(eq(engineersTable.id, engineerId))
      .returning();
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }

    res.json({ id: eng.id, isHidden: eng.isHidden });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete engineer profile and their user account (cascade all FK-dependent rows first)
router.delete("/admin/engineers/:engineerId", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId as string);
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, engineerId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }

    // Cascade-delete all FK-dependent rows in the correct order, wrapped in a transaction
    await db.transaction(async (tx) => {
      // 1. chat_attachments → chat_rooms FK
      await tx.delete(chatAttachmentsTable).where(
        sql`${chatAttachmentsTable.roomId} IN (SELECT id FROM chat_rooms WHERE engineer_id = ${engineerId})`
      );
      // 2. messages → chat_rooms FK
      await tx.delete(messagesTable).where(
        sql`${messagesTable.roomId} IN (SELECT id FROM chat_rooms WHERE engineer_id = ${engineerId})`
      );
      // 3. complaints → chat_rooms FK (must go before chat_rooms)
      await tx.delete(complaintsTable).where(
        sql`${complaintsTable.roomId} IN (SELECT id FROM chat_rooms WHERE engineer_id = ${engineerId})`
      );
      // 4. chat_rooms
      await tx.delete(chatRoomsTable).where(eq(chatRoomsTable.engineerId, engineerId));
      // 4. other engineer FK dependencies
      await tx.delete(reviewsTable).where(eq(reviewsTable.engineerId, engineerId));
      await tx.delete(leadsTable).where(eq(leadsTable.engineerId, engineerId));
      await tx.delete(profileBoostsTable).where(eq(profileBoostsTable.engineerId, engineerId));
      await tx.delete(verificationLogsTable).where(eq(verificationLogsTable.engineerId, engineerId));
      await tx.delete(bidsTable).where(eq(bidsTable.engineerId, engineerId));
      // 5. engineer profile, then notifications for the user account, then user account
      await tx.delete(engineersTable).where(eq(engineersTable.id, engineerId));
      await tx.delete(notificationsTable).where(eq(notificationsTable.userId, eng.userId));
      await tx.delete(usersTable).where(eq(usersTable.id, eng.userId));
    });
    res.json({ message: "Engineer and user account deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin Reviews Moderation ───────────────────────────────────────────────────

router.get("/admin/reviews", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { moderationStatus, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    let query = db.select().from(reviewsTable).$dynamic();
    if (moderationStatus) query = query.where(eq(reviewsTable.moderationStatus, moderationStatus));

    const all = await query.orderBy(desc(reviewsTable.createdAt)).limit(limit).offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)` }).from(reviewsTable).$dynamic();
    if (moderationStatus) countQuery = countQuery.where(eq(reviewsTable.moderationStatus, moderationStatus));
    const [{ total }] = await countQuery;

    const enriched = await Promise.all(all.map(async (review) => {
      const [author] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, review.authorId)).limit(1);
      const [eng] = await db.select({ name: usersTable.name })
        .from(engineersTable)
        .innerJoin(usersTable, eq(engineersTable.userId, usersTable.id))
        .where(eq(engineersTable.id, review.engineerId))
        .limit(1);
      return {
        ...review,
        comment: review.comment ?? null,
        authorName: author?.name ?? "—",
        authorEmail: author?.email ?? "—",
        engineerName: eng?.name ?? "—",
      };
    }));

    res.json({ items: enriched, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/reviews/:reviewId", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId as string);
    const { moderationStatus } = req.body;
    const allowed = ["pending", "published", "hidden"];
    if (!moderationStatus || !allowed.includes(moderationStatus)) {
      res.status(400).json({ error: "moderationStatus must be pending, published, or hidden" }); return;
    }

    const [updatedReview] = await db.update(reviewsTable)
      .set({ moderationStatus })
      .where(eq(reviewsTable.id, reviewId))
      .returning();
    if (!updatedReview) { res.status(404).json({ error: "Review not found" }); return; }

    const review = updatedReview;
    // Recalculate engineer rating when moderation status changes
    const publishedReviews = await db.select({ rating: reviewsTable.rating }).from(reviewsTable)
      .where(and(eq(reviewsTable.engineerId, review.engineerId), eq(reviewsTable.moderationStatus, "published")));

    const [eng] = await db.select({
      rosreestrWorksCount: engineersTable.rosreestrWorksCount,
      rosreestrRejectionsCount: engineersTable.rosreestrRejectionsCount,
      rosreestrSuspensionsCount: engineersTable.rosreestrSuspensionsCount,
    }).from(engineersTable).where(eq(engineersTable.id, review.engineerId)).limit(1);

    // Derive rosreestr score using same formula as computeRatingFromRosreestr (single source of truth)
    let rosreestrScore: number | null = null;
    if (eng && eng.rosreestrWorksCount !== null && eng.rosreestrWorksCount !== undefined) {
      const mockRecord = {
        worksCount: eng.rosreestrWorksCount ?? 0,
        rejectionsCount: eng.rosreestrRejectionsCount ?? 0,
        suspensionsCount: eng.rosreestrSuspensionsCount ?? 0,
        status: "active" as const,
        sroStatus: "active" as const,
        attestatNumber: "",
        fullName: "",
        engineerName: "",
        sroName: "",
      };
      const score = computeRatingFromRosreestr(mockRecord);
      rosreestrScore = score > 0 ? score : null;
    }

    const newRating = calculateWeightedRating(publishedReviews, rosreestrScore);
    await db.update(engineersTable)
      .set({
        rating: newRating,
        reviewCount: publishedReviews.length,
      })
      .where(eq(engineersTable.id, review.engineerId));

    // Return AdminReviewItem shape (with author/engineer names) to match OpenAPI spec
    const [author] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, review.authorId)).limit(1);
    const [engRow] = await db.select({ userId: engineersTable.userId })
      .from(engineersTable).where(eq(engineersTable.id, review.engineerId)).limit(1);
    const [engUser] = engRow
      ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, engRow.userId)).limit(1)
      : [null];

    res.json({
      id: review.id,
      orderId: review.orderId,
      authorId: review.authorId,
      authorName: author?.name ?? "—",
      authorEmail: author?.email ?? "—",
      engineerId: review.engineerId,
      engineerName: engUser?.name ?? "—",
      rating: review.rating,
      comment: review.comment ?? null,
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Rosreestr Verification Logs ───────────────────────────────────────────────

router.get("/admin/verification-logs", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 30;
    const offset = (pageNum - 1) * limit;

    const logs = await db.select().from(verificationLogsTable)
      .orderBy(desc(verificationLogsTable.checkedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(verificationLogsTable);

    const enriched = await Promise.all(logs.map(async (log) => {
      if (!log.engineerId) return { ...log, engineerName: null, engineerEmail: null };
      const [eng] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(engineersTable)
        .innerJoin(usersTable, eq(engineersTable.userId, usersTable.id))
        .where(eq(engineersTable.id, log.engineerId))
        .limit(1);
      return { ...log, engineerName: eng?.name ?? null, engineerEmail: eng?.email ?? null };
    }));

    res.json({ items: enriched, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Complaints ────────────────────────────────────────────────────────────────

router.get("/admin/complaints", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    let query = db.select().from(complaintsTable).$dynamic();
    if (status) query = query.where(eq(complaintsTable.status, status));

    const all = await query.orderBy(desc(complaintsTable.createdAt)).limit(limit).offset(offset);
    let countQuery = db.select({ total: sql<number>`count(*)` }).from(complaintsTable).$dynamic();
    if (status) countQuery = countQuery.where(eq(complaintsTable.status, status));
    const [{ total }] = await countQuery;

    const enriched = await Promise.all(all.map(async (c) => {
      const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, c.reporterId)).limit(1);

      const messages = await db.select().from(messagesTable)
        .where(eq(messagesTable.roomId, c.roomId))
        .orderBy(sql`${messagesTable.createdAt} asc`);

      const messagesWithSenders = await Promise.all(messages.map(async (m) => {
        const [sender] = await db.select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
        return {
          ...m,
          senderName: sender?.name ?? "?",
          attachmentUrl: m.attachmentUrl ?? null,
          attachmentName: m.attachmentName ?? null,
          attachmentType: m.attachmentType ?? null,
        };
      }));

      return {
        ...c,
        reporterName: reporter?.name ?? null,
        resolvedAt: c.resolvedAt?.toISOString() ?? null,
        recentMessages: messagesWithSenders,
      };
    }));

    res.json({ items: enriched, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/complaints/:complaintId/resolve", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const complaintId = parseInt(req.params.complaintId as string);
    const [updated] = await db.update(complaintsTable)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(complaintsTable.id, complaintId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Complaint not found" }); return; }

    const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, updated.reporterId)).limit(1);
    res.json({ ...updated, reporterName: reporter?.name ?? null, resolvedAt: updated.resolvedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/engineers/:id/reverify", requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const engineerId = parseInt(req.params.id as string);
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, engineerId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }

    const attestatNumber = eng.attestatNumber ?? eng.registryNumber;
    if (!attestatNumber) { res.status(400).json({ error: "Номер аттестата не указан" }); return; }

    const record = await rosreestrProvider.lookupByAttestat(attestatNumber);

    if (!record) {
      await db.update(engineersTable).set({ isVerified: false, rosreestrCheckedAt: new Date(), rosreestrStatus: "not_found" }).where(eq(engineersTable.id, engineerId));
      await db.insert(verificationLogsTable).values({
        engineerId,
        attestatNumber,
        result: "fail",
        failureReason: "Номер аттестата не найден в реестре Росреестра",
        rawSnapshot: null,
      });
      res.json({ isValid: false, message: "Номер аттестата не найден в реестре Росреестра" });
      return;
    }

    if (record.status !== "active" || record.sroStatus !== "active") {
      const reason = record.status !== "active"
        ? `Статус инженера: ${record.status === "suspended" ? "приостановлен" : "аннулирован"}`
        : "Членство в СРО не является действующим";
      await db.update(engineersTable).set({ isVerified: false, rosreestrCheckedAt: new Date(), rosreestrStatus: record.status }).where(eq(engineersTable.id, engineerId));
      await db.insert(verificationLogsTable).values({
        engineerId,
        attestatNumber,
        result: "fail",
        failureReason: reason,
        rawSnapshot: JSON.stringify(record),
      });
      res.json({ isValid: false, message: reason });
      return;
    }

    const worksCount = record.worksCount;
    const rejectionRate = worksCount > 0 ? record.rejectionsCount / worksCount : 0;
    const rosreestrBaseRating = computeRatingFromRosreestr(record);

    // Weighted rating: use published reviews + rosreestr score
    const publishedReviews = await db.select({ rating: reviewsTable.rating }).from(reviewsTable)
      .where(and(eq(reviewsTable.engineerId, engineerId), eq(reviewsTable.moderationStatus, "published")));

    const rosreestrScore = rosreestrBaseRating > 0 ? rosreestrBaseRating : null;
    const newRating = calculateWeightedRating(publishedReviews, rosreestrScore);

    const preFilledSro = !eng.sro ? record.sroName : null;
    const derivedDistrict = getDistrictFromAttestat(attestatNumber);
    const preFilledDistrict = !eng.district ? derivedDistrict : null;

    await db.update(engineersTable).set({
      isVerified: true,
      rosreestrStatus: record.status,
      sroName: record.sroName,
      ...(preFilledSro !== null ? { sro: preFilledSro } : {}),
      ...(preFilledDistrict !== null ? { district: preFilledDistrict } : {}),
      rosreestrCheckedAt: new Date(),
      rosreestrWorksCount: record.worksCount,
      rosreestrRejectionsCount: record.rejectionsCount,
      rosreestrSuspensionsCount: record.suspensionsCount,
      rosreestrRejectionRate: Math.round(rejectionRate * 1000) / 1000,
      rating: newRating > 0 ? newRating : rosreestrBaseRating,
    }).where(eq(engineersTable.id, engineerId));

    await db.insert(verificationLogsTable).values({
      engineerId,
      attestatNumber,
      result: "pass",
      failureReason: null,
      rawSnapshot: JSON.stringify(record),
    });

    res.json({ isValid: true, message: `Повторная верификация пройдена. СРО: ${record.sroName}.` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Geography / Regions ───────────────────────────────────────────────────────

router.get("/admin/regions", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const regions = await db.select().from(regionsTable).orderBy(regionsTable.federalDistrict, regionsTable.name);

    const enriched = await Promise.all(regions.map(async (r) => {
      const [{ engineerCount }] = await db
        .select({ engineerCount: sql<number>`count(*)` })
        .from(engineersTable)
        .where(sql`lower(${engineersTable.region}) = lower(${r.name})`);

      const [{ orderCount }] = await db
        .select({ orderCount: sql<number>`count(*)` })
        .from(ordersTable)
        .where(sql`lower(${ordersTable.region}) = lower(${r.name})`);

      const [{ activeOrderCount }] = await db
        .select({ activeOrderCount: sql<number>`count(*)` })
        .from(ordersTable)
        .where(and(
          sql`lower(${ordersTable.region}) = lower(${r.name})`,
          eq(ordersTable.status, "in_progress")
        ));

      const [{ completedOrderCount }] = await db
        .select({ completedOrderCount: sql<number>`count(*)` })
        .from(ordersTable)
        .where(and(
          sql`lower(${ordersTable.region}) = lower(${r.name})`,
          eq(ordersTable.status, "completed")
        ));

      const [{ avgRating }] = await db
        .select({ avgRating: sql<number>`coalesce(avg(${engineersTable.rating}), 0)` })
        .from(engineersTable)
        .where(sql`lower(${engineersTable.region}) = lower(${r.name})`);

      const engIds = await db
        .select({ id: engineersTable.id })
        .from(engineersTable)
        .where(sql`lower(${engineersTable.region}) = lower(${r.name})`);

      let leadCount = 0;
      let revenue = 0;
      if (engIds.length > 0) {
        const ids = engIds.map((e) => e.id);
        const [{ lc }] = await db
          .select({ lc: sql<number>`count(*)` })
          .from(leadsTable)
          .where(sql`${leadsTable.engineerId} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]::int[]`)})`);
        leadCount = Number(lc);
        const [{ rev }] = await db
          .select({ rev: sql<number>`coalesce(sum(${leadsTable.leadCost}), 0)` })
          .from(leadsTable)
          .where(and(
            sql`${leadsTable.engineerId} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]::int[]`)})`,
            eq(leadsTable.paymentStatus, "paid")
          ));
        revenue = Number(rev);
      }

      return {
        ...r,
        engineerCount: Number(engineerCount),
        orderCount: Number(orderCount),
        activeOrderCount: Number(activeOrderCount),
        completedOrderCount: Number(completedOrderCount),
        avgRating: Math.round(Number(avgRating) * 10) / 10,
        leadCount,
        revenue,
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/regions/:regionId", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const regionId = parseInt(req.params.regionId as string);
    const { status, comment, features, launchDate } = req.body;

    const VALID_STATUSES = ["active", "limited", "paused", "closed"];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Недопустимый статус. Допустимые: ${VALID_STATUSES.join(", ")}` });
      return;
    }

    const updates: Partial<typeof regionsTable.$inferInsert> = {};
    if (status !== undefined) updates.status = status;
    if (comment !== undefined) updates.comment = comment || null;
    if (features !== undefined) updates.features = features || null;
    if (launchDate !== undefined) updates.launchDate = launchDate ? new Date(launchDate) : null;

    const [updated] = await db.update(regionsTable)
      .set(updates)
      .where(eq(regionsTable.id, regionId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Регион не найден" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
