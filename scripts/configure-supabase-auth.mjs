/**
 * Fix Supabase Auth settings for local Pulse (redirect URLs, optional skip-email signup).
 *
 * Usage:
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/configure-supabase-auth.mjs
 *
 * Skip confirmation emails for local dev (sign up works without inbox):
 *   node scripts/configure-supabase-auth.mjs --autoconfirm
 *
 * Optional env:
 *   APP_ORIGIN=http://localhost:8080
 *   SUPABASE_PROJECT_ID=henyhxpkmtqriwecqgah
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const apiBase = "https://api.supabase.com/v1";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const autoconfirm = process.argv.includes("--autoconfirm");
const appOrigin = (process.env.APP_ORIGIN ?? "http://localhost:8080").replace(/\/$/, "");

function readEnvKey(content, key) {
  const match = content.match(new RegExp(`^${key}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, "m"));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

if (!token) {
  console.error(`
Missing SUPABASE_ACCESS_TOKEN.

1. Open https://supabase.com/dashboard/account/tokens
2. Create a token
3. Run:

   $env:SUPABASE_ACCESS_TOKEN="YOUR_TOKEN"
   node scripts/configure-supabase-auth.mjs${autoconfirm ? " --autoconfirm" : ""}
`);
  process.exit(1);
}

let envContent = "";
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Could not read .env — run from save-the-day-main with a .env file.");
  process.exit(1);
}

const projectRef =
  process.env.SUPABASE_PROJECT_ID?.trim() || readEnvKey(envContent, "SUPABASE_PROJECT_ID");

if (!projectRef) {
  console.error("Missing SUPABASE_PROJECT_ID in .env or environment.");
  process.exit(1);
}

async function api(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `Supabase API ${options.method ?? "GET"} ${path} failed (${res.status}): ${
        typeof body === "string" ? body : JSON.stringify(body)
      }`,
    );
  }
  return body;
}

async function main() {
  const redirectAllowList = [
    `${appOrigin}/`,
    `${appOrigin}/auth/callback`,
    `${appOrigin}/**`,
  ].join(",");

  const patch = {
    site_url: appOrigin,
    uri_allow_list: redirectAllowList,
    mailer_autoconfirm: autoconfirm,
  };

  console.log(`Updating auth for project ${projectRef}...`);
  console.log(`  Site URL: ${appOrigin}`);
  console.log(`  Redirects: ${redirectAllowList}`);
  console.log(`  Auto-confirm signups (no email): ${autoconfirm}`);

  await api(`/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  console.log(`
Done.

${autoconfirm
    ? "Email confirmation is OFF — you can sign up on /auth and sign in immediately."
    : `Email confirmation is still ON. If signup still fails with "Error sending confirmation email":
  - Supabase Dashboard → Authentication → Email → SMTP Settings (configure Resend/SendGrid/etc.)
  - Or re-run with --autoconfirm for local dev without emails
  - Check spam for mail from Supabase (not branded "Pulse" unless you set a custom sender)`}

Restart the app after changing auth settings: npm start
`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
