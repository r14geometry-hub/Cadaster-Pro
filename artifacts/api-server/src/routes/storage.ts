import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { fileStorageProvider } from "../lib/fileStorage";
import { requireAuth } from "../middlewares/auth";
import { db, chatAttachmentsTable, chatRoomsTable, engineersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

/** Check if a user is a member of a chat room (customer or engineer). */
async function isRoomMember(roomId: number, userId: number): Promise<boolean> {
  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).limit(1);
  if (!room) return false;
  if (room.customerId === userId) return true;
  const [eng] = await db.select().from(engineersTable).where(and(eq(engineersTable.userId, userId), eq(engineersTable.id, room.engineerId))).limit(1);
  return !!eng;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload (Replit Object Storage only).
 * On Timeweb/local storage this endpoint returns 503 — uploads should go
 * through POST /api/chats/:roomId/upload instead.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL (Replit sidecar unavailable on VPS)");
    res.status(503).json({
      error: "STORAGE_NOT_CONFIGURED",
      message: "Presigned URL upload requires Replit Object Storage. Use /api/chats/:roomId/upload for file uploads.",
    });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets. Unconditionally public — no authentication.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const { Readable } = await import("stream");
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private chat attachments. Requires auth + room membership (ACL).
 * Works with both local disk storage and Replit Object Storage.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const servingUrl = `/api/storage${objectPath}`;

    // ACL check — verify room membership via the stored upload grant
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole !== "admin" && userRole !== "superadmin") {
      const [grant] = await db
        .select({ roomId: chatAttachmentsTable.roomId })
        .from(chatAttachmentsTable)
        .where(eq(chatAttachmentsTable.servingUrl, servingUrl))
        .limit(1);

      if (!grant) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const member = await isRoomMember(grant.roomId, userId);
      if (!member) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    // Serve via the configured storage provider (local disk or Replit)
    await fileStorageProvider.serveFile(objectPath, res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
