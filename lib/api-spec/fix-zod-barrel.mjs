import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, "../api-zod/src/index.ts");
const content = readFileSync(indexPath, "utf8");
const fixed = content
  .split("\n")
  .filter((line) => !line.includes("generated/types"))
  .join("\n");
writeFileSync(indexPath, fixed, "utf8");
console.log("Fixed api-zod index.ts — removed duplicate types re-export");
