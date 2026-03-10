import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDatabaseTableCounts, initializeDatabaseSchema } from "../lib/database";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL is not set in .env.local");
  }

  await initializeDatabaseSchema();
  const counts = await getDatabaseTableCounts();

  console.log("Turso schema initialized successfully.");
  console.log(
    JSON.stringify(
      {
        hasAuthToken: Boolean(process.env.TURSO_AUTH_TOKEN),
        tableCounts: counts,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Failed to initialize Turso schema:", error);
  process.exitCode = 1;
});
