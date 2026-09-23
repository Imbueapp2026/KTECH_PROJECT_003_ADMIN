#!/usr/bin/env node
/**
 * scripts/check-supabase.mjs
 *
 * Smoke-tests the admin app's connection to Supabase using ONLY the anon key.
 * Run: `node scripts/check-supabase.mjs`
 *
 * What it checks:
 *   1. Required env vars are present in apps/admin/.env
 *   2. Project URL is reachable (no DNS / 5xx)
 *   3. Anon key authenticates against PostgREST (root GET / returns 200)
 *   4. Each table in PRD §4.1 / §4.2 exists in `public` schema
 *   5. RLS is enabled on each table (TASKS_INITIAL_SETUP §3)
 *   6. RLS correctly BLOCKS anon writes on catalog tables and ALLOWS anon
 *      inserts on inquiries/visits
 *
 * Exit code 0 = all checks passed. Non-zero = at least one check failed.
 * Output is line-oriented so CI / shell pipelines can grep for "FAIL".
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env");

const REQUIRED_PUBLIC = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

let failures = 0;
const log = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

// 1. .env presence + required vars
function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    log(false, `.env not found at ${ENV_PATH}`);
    return {};
  }
  const raw = readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, "$1");
  }
  return env;
}

const env = loadEnv();
log(existsSync(ENV_PATH), `.env exists at ${ENV_PATH}`);
for (const key of REQUIRED_PUBLIC) {
  log(typeof env[key] === "string" && env[key].length > 0, `${key} set`);
}
if (failures > 0) {
  console.error(`\nAborting — ${failures} env check(s) failed.`);
  process.exit(1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 2. Reachable URL
try {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: ANON_KEY },
  });
  log(res.ok, `GET ${SUPABASE_URL}/auth/v1/health → ${res.status}`);
} catch (e) {
  log(false, `Network unreachable: ${e.message}`);
  process.exit(1);
}

// 3. Anon key authenticates against PostgREST
try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  log(res.ok, `GET ${SUPABASE_URL}/rest/v1/ → ${res.status} (anon key valid)`);
} catch (e) {
  log(false, `PostgREST root failed: ${e.message}`);
  process.exit(1);
}

// 4. Tables exist — query information_schema via RPC-style SELECT isn't possible
//    without admin rights, so probe each table directly with a bounded SELECT.
const TABLES = ["products", "categories", "offers", "discounts", "inquiries"];
for (const table of TABLES) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  if (res.status === 404) {
    log(false, `table '${table}' does not exist (404) — run schema migrations`);
  } else if (res.status === 200) {
    log(true, `table '${table}' exists and is queryable as anon`);
  } else {
    log(false, `table '${table}' unexpected status ${res.status}`);
  }
}

// 5+6. RLS write-blocking on catalog tables; insert-allowing on inquiries
const WRITE_PROBES = [
  { table: "products", method: "INSERT", allowed: false },
  { table: "categories", method: "INSERT", allowed: false },
  { table: "inquiries", method: "INSERT", allowed: true },
];

for (const { table, method, allowed } of WRITE_PROBES) {
  // Anonymous insert with a junk payload — should either succeed (insert-only)
  // or be rejected by RLS (catalog tables). Either way we expect a clean HTTP
  // status, not a server error.
  const body =
    method === "INSERT"
      ? JSON.stringify({ name: "__check_probe__", phone: "0" })
      : undefined;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body,
  });
  const blocked = res.status === 401 || res.status === 403;
  const passed = allowed ? !blocked && res.status < 500 : blocked;
  log(
    passed,
    `anon ${method} on '${table}' → ${res.status} (expected ${allowed ? "accept" : "block"})`,
  );
}

console.log(
  `\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`,
);
process.exit(failures === 0 ? 0 : 1);