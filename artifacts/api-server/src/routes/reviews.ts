import { Router } from "express";
import { db, usersTable, engineersTable, reviewsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function formatReview(review: typeof reviewsTable.$inferSelect) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, review.authorId)).limit(1);
  const { passwordHash: _, ...safeAuthor } = author;
  return {
    ...review,
    comment: review.comment ?? null,
    serviceType: review.serviceType ?? null,
    isVerifiedPurchase: review.isVerifiedPurchase ?? true,
    moderationStatus: review.moderationStatus ?? "pending",
    author: { ...safeAuthor, phone: safeAuthor.phone ?? null, avatarUrl: safeAuthor.avatarUrl ?? null },
  };
}

export function calculateWeightedRating(publishedReviews: { rating: number }[], rosreestrScore: number | null): number {
  if (publishedReviews.length === 0 && !rosreestrScore) return 0;
  const userAvg = publishedReviews.length > 0
    ? publishedReviews.reduce((s, r) => s + r.rating, 0) / publishedReviews.length
    : 0;
  if (rosreestrScore !== null && rosreestrScore > 0) {
    if (publishedReviews.length === 0) return Math.round(rosreestrScore * 10) / 10;
    return Math.round((userAvg * 0.7 + rosreestrScore * 0.3) * 10) / 10;
  }
  return Math.round(userAvg * 10) / 10;
}

router.post("/reviews", requireAuth, async (req, res) => {
  try {
    const { orderId, engineerId, rating, comment } = req.body;
    if (!orderId || !engineerId || !rating) {
      res.status(400).json({ error: "Missing fields" }); return;
    }
    const [review] = await db.insert(reviewsTable).values({
      orderId, engineerId, authorId: req.user!.userId,
      rating, comment: comment ?? null,
      isVerifiedPurchase: true,
      moderationStatus: "pending",
    }).returning();

    res.status(201).json(await formatReview(review));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId/reviews", async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId as string);
    const reviews = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.engineerId, engineerId))
      .orderBy(sql`${reviewsTable.createdAt} desc`);

    const published = reviews.filter(r => r.moderationStatus === "published" || r.moderationStatus === null);
    res.json(await Promise.all(published.map(formatReview)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
