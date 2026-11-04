import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
// Views and role for the assistant; safe to re-run.
await pool.query(readFileSync("sql/assistant.sql", "utf8"));
await pool.end();
console.log("migrated");
