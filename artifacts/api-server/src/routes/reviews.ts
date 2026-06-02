import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, reviewsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function formatReview(review: typeof reviewsTable.$inferSelect) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, review.authorId)).limit(1);
  const { passwordHash: _, ...safeAuthor } = author;
  return {
    ...review,
    comment: review.comment ?? null,
    author: { ...safeAuthor, phone: safeAuthor.phone ?? null, avatarUrl: safeAuthor.avatarUrl ?? null },
  };
}

router.post("/reviews", requireAuth, async (req, res) => {
  try {
    const { orderId, engineerId, rating, comment } = req.body;
    if (!orderId || !engineerId || !rating) { res.status(400).json({ error: "Missing fields" }); return; }
    const [review] = await db.insert(reviewsTable).values({
      orderId, engineerId, authorId: req.user!.userId, rating, comment: comment ?? null,
    }).returning();

    const engineerReviews = await db.select().from(reviewsTable).where(eq(reviewsTable.engineerId, engineerId));
    const avgRating = engineerReviews.reduce((sum, r) => sum + r.rating, 0) / engineerReviews.length;
    await db.update(engineersTable).set({
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: engineerReviews.length,
    }).where(eq(engineersTable.id, engineerId));

    res.status(201).json(await formatReview(review));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId/reviews", async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId);
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.engineerId, engineerId)).orderBy(sql`${reviewsTable.createdAt} desc`);
    res.json(await Promise.all(reviews.map(formatReview)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
