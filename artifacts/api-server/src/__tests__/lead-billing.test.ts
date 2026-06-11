/**
 * Integration tests for lead billing and bid flow.
 *
 * Covers:
 *  1. Bid blocked when engineer debt >= debt_limit (default 3000₽)
 *  2. Lead created on bid accept at the configured price; debtAmount incremented
 *  3. PATCH /admin/leads/:id with paymentStatus=paid reduces engineer debtAmount
 *  4. Re-accepting a bid is idempotent (no duplicate lead, no double-charge)
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import supertest from "supertest";
import bcrypt from "bcryptjs";
import {
  db,
  pool,
  usersTable,
  engineersTable,
  ordersTable,
  bidsTable,
  leadsTable,
  leadPricesTable,
  chatRoomsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const agent = supertest(app);

const HASH = await bcrypt.hash("testpass", 1);

interface TestCtx {
  customerId: number;
  engineerUserId: number;
  engineerId: number;
  orderId: number;
  customerToken: string;
  engineerToken: string;
  adminId: number;
  adminToken: string;
}

async function seed(overrides: { debtAmount?: number; serviceType?: string } = {}): Promise<TestCtx> {
  const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const serviceType = overrides.serviceType ?? `TestSvc_${tag}`;

  const [customer] = await db
    .insert(usersTable)
    .values({ name: `Cust_${tag}`, email: `cust_${tag}@test.invalid`, passwordHash: HASH, role: "customer" })
    .returning({ id: usersTable.id });

  const [engUser] = await db
    .insert(usersTable)
    .values({ name: `Eng_${tag}`, email: `eng_${tag}@test.invalid`, passwordHash: HASH, role: "engineer" })
    .returning({ id: usersTable.id });

  const [adminUser] = await db
    .insert(usersTable)
    .values({ name: `Admin_${tag}`, email: `admin_${tag}@test.invalid`, passwordHash: HASH, role: "admin" })
    .returning({ id: usersTable.id });

  const [eng] = await db
    .insert(engineersTable)
    .values({
      userId: engUser.id,
      registryNumber: `TEST-${tag}`,
      region: "Москва",
      specializations: JSON.stringify([serviceType]),
      isVerified: true,
      debtAmount: overrides.debtAmount ?? 0,
    })
    .returning({ id: engineersTable.id });

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerId: customer.id,
      title: `Order_${tag}`,
      description: "Test order",
      serviceType,
      region: "Москва",
      status: "new",
    })
    .returning({ id: ordersTable.id });

  return {
    customerId: customer.id,
    engineerUserId: engUser.id,
    engineerId: eng.id,
    orderId: order.id,
    customerToken: signToken({ userId: customer.id, role: "customer" }),
    engineerToken: signToken({ userId: engUser.id, role: "engineer" }),
    adminId: adminUser.id,
    adminToken: signToken({ userId: adminUser.id, role: "admin" }),
  };
}

async function cleanup(ctx: TestCtx) {
  await db.delete(leadsTable).where(eq(leadsTable.orderId, ctx.orderId));
  await db.delete(bidsTable).where(eq(bidsTable.orderId, ctx.orderId));
  await db.delete(chatRoomsTable).where(eq(chatRoomsTable.orderId, ctx.orderId));
  await db.delete(ordersTable).where(eq(ordersTable.id, ctx.orderId));
  await db.delete(engineersTable).where(eq(engineersTable.id, ctx.engineerId));
  await db.delete(usersTable).where(eq(usersTable.id, ctx.engineerUserId));
  await db.delete(usersTable).where(eq(usersTable.id, ctx.customerId));
  await db.delete(usersTable).where(eq(usersTable.id, ctx.adminId));
}

let ctx: TestCtx;

afterAll(async () => {
  await pool.end();
});

describe("Bid flow — debt limit enforcement", () => {
  beforeEach(async () => {
    ctx = await seed({ debtAmount: 3000 });
  });

  afterEach(async () => {
    await cleanup(ctx);
  });

  it("blocks a bid when engineer debtAmount >= 3000 (default limit)", async () => {
    const res = await agent
      .post(`/api/orders/${ctx.orderId}/bids`)
      .set("Authorization", `Bearer ${ctx.engineerToken}`)
      .send({ message: "Готов помочь" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/задолженность/i);
  });

  it("allows a bid when engineer debtAmount is below the limit (2999)", async () => {
    await db
      .update(engineersTable)
      .set({ debtAmount: 2999 })
      .where(eq(engineersTable.id, ctx.engineerId));

    const res = await agent
      .post(`/api/orders/${ctx.orderId}/bids`)
      .set("Authorization", `Bearer ${ctx.engineerToken}`)
      .send({ message: "Готов помочь" });

    expect(res.status).toBe(201);
  });
});

describe("Bid accept — lead creation and debtAmount increment", () => {
  beforeEach(async () => {
    ctx = await seed({ debtAmount: 0 });
  });

  afterEach(async () => {
    await cleanup(ctx);
  });

  it("creates a lead at the fallback price (500₽) and increments engineer debtAmount", async () => {
    const bidRes = await agent
      .post(`/api/orders/${ctx.orderId}/bids`)
      .set("Authorization", `Bearer ${ctx.engineerToken}`)
      .send({ message: "Хочу взять заявку" });

    expect(bidRes.status).toBe(201);
    const bidId: number = bidRes.body.id;

    const acceptRes = await agent
      .patch(`/api/orders/${ctx.orderId}/bids/${bidId}`)
      .set("Authorization", `Bearer ${ctx.customerToken}`)
      .send({ status: "accepted" });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.status).toBe("accepted");

    const leads = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.orderId, ctx.orderId), eq(leadsTable.engineerId, ctx.engineerId)));

    expect(leads).toHaveLength(1);
    expect(leads[0].leadCost).toBe(500);
    expect(leads[0].paymentStatus).toBe("unpaid");

    const [eng] = await db
      .select({ debtAmount: engineersTable.debtAmount })
      .from(engineersTable)
      .where(eq(engineersTable.id, ctx.engineerId));

    expect(eng.debtAmount).toBe(500);
  });

  it("creates a lead at the configured lead price when one exists for the service type", async () => {
    const tag = Date.now().toString(36);
    const serviceType = `PricedSvc_${tag}`;

    const [customOrder] = await db
      .insert(ordersTable)
      .values({
        customerId: ctx.customerId,
        title: `PricedOrder_${tag}`,
        description: "Priced test",
        serviceType,
        region: "Москва",
        status: "new",
      })
      .returning({ id: ordersTable.id });

    await db
      .insert(leadPricesTable)
      .values({ serviceType, price: 750 })
      .onConflictDoNothing();

    const bidRes = await agent
      .post(`/api/orders/${customOrder.id}/bids`)
      .set("Authorization", `Bearer ${ctx.engineerToken}`)
      .send({ message: "Берусь за работу" });

    expect(bidRes.status).toBe(201);
    const bidId: number = bidRes.body.id;

    const acceptRes = await agent
      .patch(`/api/orders/${customOrder.id}/bids/${bidId}`)
      .set("Authorization", `Bearer ${ctx.customerToken}`)
      .send({ status: "accepted" });

    expect(acceptRes.status).toBe(200);

    const leads = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.orderId, customOrder.id), eq(leadsTable.engineerId, ctx.engineerId)));

    expect(leads).toHaveLength(1);
    expect(leads[0].leadCost).toBe(750);

    await db.delete(leadsTable).where(eq(leadsTable.orderId, customOrder.id));
    await db.delete(bidsTable).where(eq(bidsTable.orderId, customOrder.id));
    await db.delete(chatRoomsTable).where(eq(chatRoomsTable.orderId, customOrder.id));
    await db.delete(ordersTable).where(eq(ordersTable.id, customOrder.id));
    await db.delete(leadPricesTable).where(eq(leadPricesTable.serviceType, serviceType));
  });
});

describe("Admin lead payment — debtAmount reduction", () => {
  beforeEach(async () => {
    ctx = await seed({ debtAmount: 500 });
  });

  afterEach(async () => {
    await cleanup(ctx);
  });

  it("marks lead as paid and decrements engineer debtAmount", async () => {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        orderId: ctx.orderId,
        engineerId: ctx.engineerId,
        serviceType: "TestSvc",
        leadCost: 500,
        paymentStatus: "unpaid",
      })
      .returning({ id: leadsTable.id });

    const res = await agent
      .patch(`/api/admin/leads/${lead.id}`)
      .set("Authorization", `Bearer ${ctx.adminToken}`)
      .send({ paymentStatus: "paid" });

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("paid");

    const [eng] = await db
      .select({ debtAmount: engineersTable.debtAmount })
      .from(engineersTable)
      .where(eq(engineersTable.id, ctx.engineerId));

    expect(eng.debtAmount).toBe(0);
  });

  it("re-marks lead as unpaid and increments engineer debtAmount", async () => {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        orderId: ctx.orderId,
        engineerId: ctx.engineerId,
        serviceType: "TestSvc",
        leadCost: 500,
        paymentStatus: "paid",
      })
      .returning({ id: leadsTable.id });

    await db
      .update(engineersTable)
      .set({ debtAmount: 0 })
      .where(eq(engineersTable.id, ctx.engineerId));

    const res = await agent
      .patch(`/api/admin/leads/${lead.id}`)
      .set("Authorization", `Bearer ${ctx.adminToken}`)
      .send({ paymentStatus: "unpaid" });

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("unpaid");

    const [eng] = await db
      .select({ debtAmount: engineersTable.debtAmount })
      .from(engineersTable)
      .where(eq(engineersTable.id, ctx.engineerId));

    expect(eng.debtAmount).toBe(500);
  });

  it("returns 404 for a non-existent lead", async () => {
    const res = await agent
      .patch("/api/admin/leads/999999999")
      .set("Authorization", `Bearer ${ctx.adminToken}`)
      .send({ paymentStatus: "paid" });

    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin tries to mark a lead paid", async () => {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        orderId: ctx.orderId,
        engineerId: ctx.engineerId,
        serviceType: "TestSvc",
        leadCost: 500,
        paymentStatus: "unpaid",
      })
      .returning({ id: leadsTable.id });

    const res = await agent
      .patch(`/api/admin/leads/${lead.id}`)
      .set("Authorization", `Bearer ${ctx.engineerToken}`)
      .send({ paymentStatus: "paid" });

    expect(res.status).toBe(403);
  });
});

describe("Bid accept idempotency — no duplicate leads", () => {
  beforeEach(async () => {
    ctx = await seed({ debtAmount: 0 });
  });

  afterEach(async () => {
    await cleanup(ctx);
  });

  it("does not create a duplicate lead when bid is accepted a second time", async () => {
    const bidRes = await agent
      .post(`/api/orders/${ctx.orderId}/bids`)
      .set("Authorization", `Bearer ${ctx.engineerToken}`)
      .send({ message: "Буду рад помочь" });

    expect(bidRes.status).toBe(201);
    const bidId: number = bidRes.body.id;

    await agent
      .patch(`/api/orders/${ctx.orderId}/bids/${bidId}`)
      .set("Authorization", `Bearer ${ctx.customerToken}`)
      .send({ status: "accepted" });

    const debtAfterFirst = (
      await db
        .select({ debtAmount: engineersTable.debtAmount })
        .from(engineersTable)
        .where(eq(engineersTable.id, ctx.engineerId))
    )[0].debtAmount;

    await agent
      .patch(`/api/orders/${ctx.orderId}/bids/${bidId}`)
      .set("Authorization", `Bearer ${ctx.customerToken}`)
      .send({ status: "accepted" });

    const leadsAfterSecond = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.orderId, ctx.orderId), eq(leadsTable.engineerId, ctx.engineerId)));

    const [eng] = await db
      .select({ debtAmount: engineersTable.debtAmount })
      .from(engineersTable)
      .where(eq(engineersTable.id, ctx.engineerId));

    expect(leadsAfterSecond).toHaveLength(1);
    expect(eng.debtAmount).toBe(debtAfterFirst);
  });
});
