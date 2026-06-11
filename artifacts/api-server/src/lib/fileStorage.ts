/**
 * Unified file storage abstraction.
 *
 * Two providers:
 *  - LocalFileStorageProvider  — writes to disk; for VPS / Timeweb production.
 *  - ReplitFileStorageProvider — delegates to Replit Object Storage sidecar.
 *
 * Selection (in priority order):
 *  1. STORAGE_PROVIDER=local  → always local
 *  2. STORAGE_PROVIDER=replit → always Replit
 *  3. NODE_ENV=production      → local  (Replit sidecar not available)
 *  4. REPL_ID is set           → Replit (we're running inside Replit)
 *  5. fallback                 → local
 */
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { logger } from "./logger";

// ─── Interface ──────────────────────────────────────────────────────────────

export interface UploadResult {
  objectPath: string;
  servingUrl: string;
}

export interface FileStorageProvider {
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
  serveFile(objectPath: string, res: Response): Promise<void>;
}

// ─── Local (disk) provider ─────────────────────────────────────────────────

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ??
  (process.env.NODE_ENV === "production" ? "/var/www/kadastr/uploads" : "./uploads");

const MIME_BY_EXT: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls":  "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".zip":  "application/zip",
};

class LocalFileStorageProvider implements FileStorageProvider {
  async upload(buffer: Buffer, filename: string, _mimeType: string): Promise<UploadResult> {
    const uuid = randomUUID();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = path.join(UPLOAD_DIR, uuid);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, safeName), buffer);
    const objectPath = `/objects/${uuid}/${safeName}`;
    return { objectPath, servingUrl: `/api/storage${objectPath}` };
  }

  async serveFile(objectPath: string, res: Response): Promise<void> {
    // objectPath looks like /objects/{uuid}/{filename}
    const relative = objectPath.replace(/^\/objects\//, "");
    const fullPath = path.join(UPLOAD_DIR, relative);

    try {
      await fs.access(fullPath);
    } catch {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const stat = await fs.stat(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const stream = fsSync.createReadStream(fullPath);
    stream.on("error", (err) => {
      logger.error({ err }, "Error streaming local file");
      if (!res.headersSent) res.status(500).json({ error: "Stream error" });
    });
    stream.pipe(res);
  }
}

// ─── Replit sidecar provider ────────────────────────────────────────────────

class ReplitFileStorageProvider implements FileStorageProvider {
  private svc = new ObjectStorageService();

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const uploadURL = await this.svc.getObjectEntityUploadURL();
    const objectPath = this.svc.normalizeObjectEntityPath(uploadURL);

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Replit storage upload failed: HTTP ${uploadResponse.status}`);
    }

    return { objectPath, servingUrl: `/api/storage${objectPath}` };
  }

  async serveFile(objectPath: string, res: Response): Promise<void> {
    try {
      const objectFile = await this.svc.getObjectEntityFile(objectPath);
      const response = await this.svc.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "File not found" });
      } else {
        throw err;
      }
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

function createProvider(): FileStorageProvider {
  const override = process.env.STORAGE_PROVIDER?.toLowerCase();

  if (override === "local") {
    logger.info({ uploadDir: UPLOAD_DIR }, "Storage: local disk");
    return new LocalFileStorageProvider();
  }

  if (override === "replit") {
    logger.info("Storage: Replit object storage (forced)");
    return new ReplitFileStorageProvider();
  }

  if (process.env.NODE_ENV === "production") {
    logger.info({ uploadDir: UPLOAD_DIR }, "Storage: local disk (production default)");
    return new LocalFileStorageProvider();
  }

  if (process.env.REPL_ID) {
    logger.info("Storage: Replit object storage (REPL_ID detected)");
    return new ReplitFileStorageProvider();
  }

  logger.info({ uploadDir: UPLOAD_DIR }, "Storage: local disk (fallback)");
  return new LocalFileStorageProvider();
}

export const fileStorageProvider: FileStorageProvider = createProvider();
