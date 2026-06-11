import { db, engineersTable, verificationLogsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { rosreestrProvider, computeRatingFromRosreestr } from "./rosreestr";
import { getDistrictFromAttestat } from "../utils/attestat-district";
import { calculateWeightedRating } from "../routes/reviews";
import { reviewsTable } from "@workspace/db";

const REVERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function sendEngineerNotification(userId: number, title: string, message: string, type: string): Promise<void> {
  try {
    await db.insert(notificationsTable).values({ userId, title, message, type });
  } catch (err) {
    logger.error({ err, userId }, "Failed to insert notification for engineer");
  }
}

async function reverifyAllEngineers(): Promise<void> {
  logger.info("Scheduled re-verification: starting");

  const engineers = await db
    .select()
    .from(engineersTable)
    .where(and(eq(engineersTable.isVerified, true), isNotNull(engineersTable.attestatNumber)));

  logger.info({ count: engineers.length }, "Scheduled re-verification: engineers to check");

  let verified = 0;
  let revoked = 0;
  let notFound = 0;

  for (const eng of engineers) {
    try {
      const attestatNumber = eng.attestatNumber!;
      const record = await rosreestrProvider.lookupByAttestat(attestatNumber);

      if (!record) {
        await db
          .update(engineersTable)
          .set({ isVerified: false, rosreestrCheckedAt: new Date(), rosreestrStatus: "not_found" })
          .where(eq(engineersTable.id, eng.id));

        await db.insert(verificationLogsTable).values({
          engineerId: eng.id,
          attestatNumber,
          result: "fail",
          failureReason: "Аттестат не найден в реестре (плановая проверка)",
          rawSnapshot: null,
        });

        await sendEngineerNotification(
          eng.userId,
          "Аттестат не подтверждён",
          `Плановая проверка реестра Росреестра не нашла аттестат ${attestatNumber}. Ваш профиль переведён в статус «не верифицирован». Пожалуйста, обратитесь в поддержку или проверьте корректность номера аттестата.`,
          "warning"
        );

        notFound++;
        logger.warn({ engineerId: eng.id, attestatNumber }, "Scheduled re-verification: attestat not found, engineer unverified");
        continue;
      }

      if (record.status !== "active" || record.sroStatus !== "active") {
        const isSuspended = record.status === "suspended";
        const isRevoked = record.status === "revoked";
        const sroInactive = record.sroStatus !== "active";

        const reason =
          isSuspended
            ? "Статус инженера: приостановлен (плановая проверка)"
            : isRevoked
            ? "Статус инженера: аннулирован (плановая проверка)"
            : "Членство в СРО не является действующим (плановая проверка)";

        await db
          .update(engineersTable)
          .set({ isVerified: false, rosreestrCheckedAt: new Date(), rosreestrStatus: record.status })
          .where(eq(engineersTable.id, eng.id));

        await db.insert(verificationLogsTable).values({
          engineerId: eng.id,
          attestatNumber,
          result: "fail",
          failureReason: reason,
          rawSnapshot: JSON.stringify(record),
        });

        const notificationMessage = isSuspended
          ? `Плановая проверка выявила, что действие вашего аттестата (${attestatNumber}) приостановлено. Ваш профиль переведён в статус «не верифицирован». Для восстановления статуса устраните причину приостановки и повторно пройдите верификацию.`
          : isRevoked
          ? `Плановая проверка выявила, что ваш аттестат (${attestatNumber}) аннулирован. Ваш профиль переведён в статус «не верифицирован». Обратитесь в Росреестр для уточнения деталей.`
          : `Плановая проверка выявила, что членство в СРО для аттестата ${attestatNumber} недействительно. Ваш профиль переведён в статус «не верифицирован». Пожалуйста, восстановите членство в СРО и повторно пройдите верификацию.`;

        await sendEngineerNotification(
          eng.userId,
          isSuspended ? "Аттестат приостановлен" : isRevoked ? "Аттестат аннулирован" : "Членство в СРО недействительно",
          notificationMessage,
          "error"
        );

        revoked++;
        logger.warn({ engineerId: eng.id, attestatNumber, status: record.status }, "Scheduled re-verification: engineer revoked/suspended");
        continue;
      }

      const worksCount = record.worksCount;
      const rejectionRate = worksCount > 0 ? record.rejectionsCount / worksCount : 0;
      const rosreestrBaseRating = computeRatingFromRosreestr(record);

      const publishedReviews = await db
        .select({ rating: reviewsTable.rating })
        .from(reviewsTable)
        .where(and(eq(reviewsTable.engineerId, eng.id), eq(reviewsTable.moderationStatus, "published")));

      const rosreestrScore = rosreestrBaseRating > 0 ? rosreestrBaseRating : null;
      const newRating = calculateWeightedRating(publishedReviews, rosreestrScore);

      const preFilledSro = !eng.sro ? record.sroName : null;
      const derivedDistrict = getDistrictFromAttestat(attestatNumber);
      const preFilledDistrict = !eng.district ? derivedDistrict : null;

      await db
        .update(engineersTable)
        .set({
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
        })
        .where(eq(engineersTable.id, eng.id));

      await db.insert(verificationLogsTable).values({
        engineerId: eng.id,
        attestatNumber,
        result: "pass",
        failureReason: null,
        rawSnapshot: JSON.stringify(record),
      });

      verified++;
    } catch (err) {
      logger.error({ err, engineerId: eng.id }, "Scheduled re-verification: error processing engineer");
    }
  }

  logger.info({ verified, revoked, notFound }, "Scheduled re-verification: complete");
}

export function startReverificationScheduler(): void {
  const runAndSchedule = () => {
    reverifyAllEngineers().catch((err) =>
      logger.error({ err }, "Scheduled re-verification: unhandled error")
    );
  };

  setTimeout(runAndSchedule, 5 * 60 * 1000);

  setInterval(runAndSchedule, REVERIFY_INTERVAL_MS);

  logger.info(
    { intervalHours: REVERIFY_INTERVAL_MS / 3600000, initialDelayMinutes: 5 },
    "Scheduled re-verification: scheduler started"
  );
}
