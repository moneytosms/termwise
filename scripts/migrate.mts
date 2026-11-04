import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { escapeLiteral, Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
// Views and role for the assistant; safe to re-run.
await pool.query(readFileSync("sql/assistant.sql", "utf8"));
// The role is created with a local default password; a deployed database takes the one in ASSISTANT_DATABASE_URL.
const assistantPassword = process.env.ASSISTANT_DATABASE_URL && decodeURIComponent(new URL(process.env.ASSISTANT_DATABASE_URL).password);
if (assistantPassword) await pool.query(`ALTER ROLE termwise_assistant PASSWORD ${escapeLiteral(assistantPassword)}`);
await pool.end();
console.log("migrated");
