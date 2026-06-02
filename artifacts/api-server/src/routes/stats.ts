import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/stats/summary", async (req, res) => {
  try {
    const [{ total: totalEngineers }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable);
    const [{ total: verifiedEngineers }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable).where(eq(engineersTable.isVerified, true));
    const [{ total: totalOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable);
    const [{ total: completedOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "completed"));
    const [{ total: totalCustomers }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "customer"));
    res.json({
      totalEngineers: Number(totalEngineers),
      verifiedEngineers: Number(verifiedEngineers),
      totalOrders: Number(totalOrders),
      completedOrders: Number(completedOrders),
      totalCustomers: Number(totalCustomers),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
