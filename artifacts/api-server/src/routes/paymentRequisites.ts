import { Router } from "express";
import { db, paymentRequisitesTable, paymentRequisitesLogTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logChange(
  requisiteId: number,
  changedBy: number,
  action: string,
  fieldName: string | null,
  oldValue: string | null,
  newValue: string | null,
) {
  await db.insert(paymentRequisitesLogTable).values({
    requisiteId,
    changedBy,
    action,
    fieldName,
    oldValue,
    newValue,
    changedAt: new Date(),
  });
}

const EDITABLE_FIELDS = [
  "fullName", "cardNumber", "phone", "bank", "email", "paymentComment", "recipientType",
] as const;

// ─── GET /admin/payment-requisites — list all (superadmin) ────────────────────

router.get("/admin/payment-requisites", requireAuth, requireRole("superadmin"), async (req, res) => {
  const requisites = await db
    .select()
    .from(paymentRequisitesTable)
    .orderBy(desc(paymentRequisitesTable.createdAt));

  const withCreator = await Promise.all(
    requisites.map(async (r: typeof paymentRequisitesTable.$inferSelect) => {
      if (!r.createdBy) return { ...r, createdByName: null };
      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.createdBy));
      return { ...r, createdByName: user?.name ?? null };
    }),
  );

  res.json(withCreator);
});

// ─── POST /admin/payment-requisites — create (superadmin) ─────────────────────

router.post("/admin/payment-requisites", requireAuth, requireRole("superadmin"), async (req, res) => {
  const userId = (req as unknown as { user: { id: number } }).user.id;
  const { fullName, cardNumber, phone, bank, email, paymentComment, recipientType } = req.body as {
    fullName: string;
    cardNumber?: string;
    phone?: string;
    bank?: string;
    email?: string;
    paymentComment?: string;
    recipientType?: string;
  };

  if (!fullName?.trim()) {
    res.status(400).json({ error: "fullName обязателен" });
    return;
  }

  const [created] = await db.insert(paymentRequisitesTable).values({
    fullName: fullName.trim(),
    cardNumber: cardNumber?.trim() || null,
    phone: phone?.trim() || null,
    bank: bank?.trim() || null,
    email: email?.trim() || null,
    paymentComment: paymentComment?.trim() || null,
    recipientType: (recipientType as "individual" | "self_employed" | "ip" | "company") ?? "individual",
    status: "archive",
    createdBy: userId,
  }).returning();

  await logChange(created.id, userId, "create", null, null, JSON.stringify({
    fullName: created.fullName,
    recipientType: created.recipientType,
  }));

  res.status(201).json(created);
});

// ─── PATCH /admin/payment-requisites/:id — update fields (superadmin) ─────────

router.patch("/admin/payment-requisites/:id", requireAuth, requireRole("superadmin"), async (req, res) => {
  const userId = (req as unknown as { user: { id: number } }).user.id;
  const id = parseInt(req.params["id"] as string);

  const [existing] = await db.select().from(paymentRequisitesTable).where(eq(paymentRequisitesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Реквизиты не найдены" }); return; }

  const updates: Partial<typeof paymentRequisitesTable.$inferInsert> = {};
  const logPromises: Promise<void>[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (!(field in req.body)) continue;
    const newVal = (req.body as Record<string, string>)[field]?.trim() || null;
    const oldVal = (existing[field] as string | null) ?? null;
    if (newVal === oldVal) continue;
    (updates as Record<string, string | null>)[field] = newVal;
    logPromises.push(logChange(id, userId, "update", field, oldVal, newVal));
  }

  if (Object.keys(updates).length === 0) {
    res.json(existing);
    return;
  }

  updates.updatedAt = new Date();
  const [updated] = await db.update(paymentRequisitesTable).set(updates).where(eq(paymentRequisitesTable.id, id)).returning();
  await Promise.all(logPromises);

  res.json(updated);
});

// ─── POST /admin/payment-requisites/:id/activate — set active (superadmin) ────

router.post("/admin/payment-requisites/:id/activate", requireAuth, requireRole("superadmin"), async (req, res) => {
  const userId = (req as unknown as { user: { id: number } }).user.id;
  const id = parseInt(req.params["id"] as string);

  const [target] = await db.select().from(paymentRequisitesTable).where(eq(paymentRequisitesTable.id, id));
  if (!target) { res.status(404).json({ error: "Реквизиты не найдены" }); return; }

  // Archive all currently active
  const currentActives = await db.select({ id: paymentRequisitesTable.id })
    .from(paymentRequisitesTable)
    .where(eq(paymentRequisitesTable.status, "active"));

  for (const active of currentActives) {
    if (active.id === id) continue;
    await db.update(paymentRequisitesTable).set({ status: "archive", updatedAt: new Date() }).where(eq(paymentRequisitesTable.id, active.id));
    await logChange(active.id, userId, "status_change", "status", "active", "archive");
  }

  const [updated] = await db.update(paymentRequisitesTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(paymentRequisitesTable.id, id))
    .returning();

  if (target.status !== "active") {
    await logChange(id, userId, "status_change", "status", target.status, "active");
  }

  res.json(updated);
});

// ─── POST /admin/payment-requisites/:id/archive — archive (superadmin) ────────

router.post("/admin/payment-requisites/:id/archive", requireAuth, requireRole("superadmin"), async (req, res) => {
  const userId = (req as unknown as { user: { id: number } }).user.id;
  const id = parseInt(req.params["id"] as string);

  const [existing] = await db.select().from(paymentRequisitesTable).where(eq(paymentRequisitesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Реквизиты не найдены" }); return; }

  const [updated] = await db.update(paymentRequisitesTable)
    .set({ status: "archive", updatedAt: new Date() })
    .where(eq(paymentRequisitesTable.id, id))
    .returning();

  if (existing.status !== "archive") {
    await logChange(id, userId, "status_change", "status", existing.status, "archive");
  }

  res.json(updated);
});

// ─── GET /admin/payment-requisites/:id/log — audit log (superadmin) ───────────

router.get("/admin/payment-requisites/:id/log", requireAuth, requireRole("superadmin"), async (req, res) => {
  const id = parseInt(req.params["id"] as string);

  const logs = await db
    .select({
      id: paymentRequisitesLogTable.id,
      action: paymentRequisitesLogTable.action,
      fieldName: paymentRequisitesLogTable.fieldName,
      oldValue: paymentRequisitesLogTable.oldValue,
      newValue: paymentRequisitesLogTable.newValue,
      changedAt: paymentRequisitesLogTable.changedAt,
      changedByName: usersTable.name,
    })
    .from(paymentRequisitesLogTable)
    .leftJoin(usersTable, eq(paymentRequisitesLogTable.changedBy, usersTable.id))
    .where(eq(paymentRequisitesLogTable.requisiteId, id))
    .orderBy(desc(paymentRequisitesLogTable.changedAt));

  res.json(logs);
});

// ─── GET /payment-requisites/active — active requisite for engineers ───────────

router.get("/payment-requisites/active", requireAuth, async (req, res) => {
  const [active] = await db
    .select()
    .from(paymentRequisitesTable)
    .where(eq(paymentRequisitesTable.status, "active"));

  if (!active) {
    res.status(404).json({ error: "Реквизиты не заданы" });
    return;
  }

  // Strip internal fields for non-admins
  const { createdBy, ...publicFields } = active;
  void createdBy;
  res.json(publicFields);
});

export default router;
