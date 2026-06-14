import { Router } from "express";
import { db, usersTable, ordersTable, engineersTable, reviewsTable, regionsTable, notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { calculateWeightedRating } from "./reviews";
import { orderMatchesTerritories, type ServiceArea } from "../lib/territory-match";
import { isValidDistrict, isValidLocality } from "../lib/address-lookup";

const router = Router();

async function formatOrder(order: typeof ordersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1);
  const { passwordHash: _, ...safeUser } = user;
  return {
    ...order,
    customer: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null },
    budget: order.budget ?? null,
    deadline: order.deadline ?? null,
  };
}

router.get("/orders", optionalAuth, async (req, res) => {
  try {
    const { status, serviceType, region, customerId, page = "1", limit = "12", forEngineer } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status) conditions.push(eq(ordersTable.status, status));
    if (serviceType) conditions.push(eq(ordersTable.serviceType, serviceType));
    if (region) conditions.push(eq(ordersTable.region, region));

    // Enforce ownership: customerId filter is only allowed for admins or the owner themselves.
    if (customerId) {
      const reqUser = req.user;
      const isAdmin = reqUser?.role === "admin" || reqUser?.role === "superadmin";
      if (isAdmin) {
        conditions.push(eq(ordersTable.customerId, parseInt(customerId)));
      } else if (reqUser) {
        // Non-admin can only see their own orders — force their own ID
        conditions.push(eq(ordersTable.customerId, reqUser.userId));
      }
      // Unauthenticated: customerId param is ignored (no private filtering)
    }

    let query = db.select().from(ordersTable).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));

    const allRows = await query.orderBy(sql`${ordersTable.createdAt} desc`);

    // Territory-based filtering for engineer context
    let filtered = allRows;
    if (forEngineer) {
      const engineerId = parseInt(forEngineer);
      const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, engineerId)).limit(1);
      if (eng) {
        let areas: ServiceArea[] = [];
        try { areas = JSON.parse(eng.serviceAreas) as ServiceArea[]; } catch { areas = []; }
        if (areas.length > 0) {
          filtered = allRows.filter(o => orderMatchesTerritories(
            { region: o.region, district: o.district, locality: o.locality },
            areas
          ));
        }
      }
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limitNum);
    const items = await Promise.all(paginated.map(formatOrder));
    res.json({ items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders/recent", async (req, res) => {
  try {
    // Show orders that are new or collecting responses
    const all = await db.select().from(ordersTable)
      .where(sql`${ordersTable.status} IN ('new', 'open', 'collecting_responses')`)
      .orderBy(sql`${ordersTable.createdAt} desc`)
      .limit(6);
    res.json(await Promise.all(all.map(formatOrder)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  try {
    const { title, description, serviceType, region, district, locality, address, budget, deadline, asDraft } = req.body;
    if (!title || !description || !serviceType || !region) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }

    // Region enforcement — block new orders in non-active regions
    const [regionRow] = await db.select().from(regionsTable)
      .where(sql`lower(${regionsTable.name}) = lower(${region})`).limit(1);
    if (regionRow && regionRow.status !== "active") {
      const messages: Record<string, string> = {
        limited: "Регион работает в ограниченном режиме. Размещение новых заявок недоступно.",
        paused: "Регион временно приостановлен. Размещение новых заявок недоступно.",
        closed: "Регион закрыт. Размещение новых заявок недоступно.",
      };
      res.status(403).json({ error: messages[regionRow.status] ?? "Регион недоступен." });
      return;
    }

    // Geography validation — only when using the built-in address DB (no DaData key).
    // DaData returns values that may not match the built-in reference, so skip in that case.
    if (!process.env.DADATA_API_KEY) {
      if (district && !isValidDistrict(region, district)) {
        res.status(400).json({ error: "Некорректный район для выбранного региона. Выберите район из списка." });
        return;
      }
      // locality is free-text — not validated against the reference
    }

    const [order] = await db.insert(ordersTable).values({
      customerId: req.user!.userId,
      title, description, serviceType, region,
      district: district ?? null,
      locality: locality ?? null,
      address: address ?? null,
      budget: budget ?? null,
      deadline: deadline ?? null,
      status: asDraft ? "draft" : "new",
    }).returning();

    // Notify matching engineers about the new order
    if (!asDraft) {
      try {
        const allEngineers = await db.select().from(engineersTable)
          .where(and(eq(engineersTable.isVerified, true)));

        const matchingUserIds: number[] = [];
        for (const eng of allEngineers) {
          let areas: ServiceArea[] = [];
          try { areas = JSON.parse(eng.serviceAreas) as ServiceArea[]; } catch { areas = []; }
          if (orderMatchesTerritories({ region: order.region, district: order.district, locality: order.locality }, areas)) {
            matchingUserIds.push(eng.userId);
          }
        }

        if (matchingUserIds.length > 0) {
          await db.insert(notificationsTable).values(
            matchingUserIds.map(uid => ({
              userId: uid,
              type: "new_order" as const,
              title: "Новая заявка в вашем регионе",
              message: `${order.title} · ${order.region}${order.locality ? `, ${order.locality}` : ""}`,
              link: `/orders/${order.id}`,
            }))
          );
        }
      } catch (notifErr) {
        req.log.warn({ err: notifErr }, "Failed to send new-order notifications");
      }
    }

    res.status(201).json(await formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    res.json(await formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const { title, description, status, budget, deadline } = req.body;
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superadmin";
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      const normalised = status === "open" ? "new" : status;
      if (!isAdmin) {
        // Enforce finite state machine for non-admins
        const CUSTOMER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
          draft:                ["new", "cancelled"],
          new:                  ["cancelled"],
          open:                 ["cancelled"],
          collecting_responses: ["cancelled"],
          engineer_selected:    ["in_progress", "cancelled"],
          in_progress:          ["cancelled"],
          completed:            [],
          cancelled:            [],
        };
        const allowed = CUSTOMER_ALLOWED_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(normalised)) {
          res.status(400).json({ error: `Invalid status transition from '${order.status}' to '${normalised}'` }); return;
        }
      }
      updates.status = normalised;
    }
    if (budget !== undefined) updates.budget = budget;
    if (deadline !== undefined) updates.deadline = deadline;
    const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
    res.json(await formatOrder(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders/:orderId/complete", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const { rating, comment, engineerId } = req.body;

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const completable = ["in_progress"];
    if (!completable.includes(order.status)) {
      res.status(400).json({ error: "Order cannot be completed from its current status" }); return;
    }

    await db.update(ordersTable).set({ status: "completed" }).where(eq(ordersTable.id, id));

    let review = null;
    if (rating && engineerId) {
      const [r] = await db.insert(reviewsTable).values({
        orderId: id,
        authorId: req.user!.userId,
        engineerId,
        rating,
        comment: comment ?? null,
        isVerifiedPurchase: true,
        moderationStatus: "pending",
      }).returning();
      review = r;

      // Only increment completedOrders — rating/reviewCount update deferred to moderation publish
      await db.update(engineersTable)
        .set({ completedOrders: sql`${engineersTable.completedOrders} + 1` })
        .where(eq(engineersTable.id, engineerId));
    }

    const updatedOrder = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    res.json({ order: await formatOrder(updatedOrder[0]), review });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(ordersTable).where(eq(ordersTable.id, id));
    res.json({ message: "Order deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
