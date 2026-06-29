/**
 * Create a new Supabase cloud project and write keys to .env.
 *
 * Usage:
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   node scripts/setup-supabase.mjs
 *
 * Optional env:
 *   APP_ORIGIN=http://localhost:8080
 *   PROJECT_NAME=pulse-save-the-day
 *   SUPABASE_REGION=ap-southeast-1
 */

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const apiBase = "https://api.supabase.com/v1";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const appOrigin = (process.env.APP_ORIGIN ?? "http://localhost:8080").replace(/\/$/, "");
const projectName = process.env.PROJECT_NAME ?? "pulse-save-the-day";
const region = process.env.SUPABASE_REGION ?? "ap-southeast-1";

if (!token) {
  console.error(`
Missing SUPABASE_ACCESS_TOKEN.

1. Open https://supabase.com/dashboard/account/tokens
2. Create a token (name it anything, e.g. "save-the-day-setup")
3. Run:

   $env:SUPABASE_ACCESS_TOKEN="YOUR_TOKEN_HERE"
   node scripts/setup-supabase.mjs
`);
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

function upsertEnv(content, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return `${content.trimEnd()}\n${line}\n`;
}

function waitForProject(ref) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const project = await api(`/projects/${ref}`);
        if (project.status === "ACTIVE_HEALTHY") {
          resolve(project);
          return;
        }
        if (Date.now() - started > 10 * 60 * 1000) {
          reject(new Error(`Project ${ref} did not become active in time (status: ${project.status})`));
          return;
        }
        process.stdout.write(".");
        setTimeout(tick, 8000);
      } catch (err) {
        reject(err);
      }
    };
    tick();
  });
}

async function main() {
  console.log("Fetching Supabase organizations...");
  const orgs = await api("/organizations");
  if (!orgs?.length) throw new Error("No Supabase organizations found on this account.");

  const org = orgs[0];
  console.log(`Using organization: ${org.name} (${org.id})`);

  const dbPass = randomBytes(18).toString("base64url");
  console.log(`Creating project "${projectName}" in ${region}...`);

  const created = await api("/projects", {
    method: "POST",
    body: JSON.stringify({
      organization_id: org.id,
      name: projectName,
      region,
      db_pass: dbPass,
    }),
  });

  const ref = created.id;
  console.log(`\nProject ref: ${ref}. Waiting for project to become active`);
  await waitForProject(ref);
  console.log("\nProject is active.");

  console.log("Fetching API keys...");
  const keys = await api(`/projects/${ref}/api-keys`);
  const publishable =
    keys.find((k) => k.name === "anon" || k.type === "publishable")?.api_key ??
    keys.find((k) => k.name === "anon")?.api_key;
  const serviceRole =
    keys.find((k) => k.name === "service_role" || k.type === "secret")?.api_key ??
    keys.find((k) => k.name === "service_role")?.api_key;

  if (!publishable) throw new Error("Could not find publishable/anon key for new project.");

  const supabaseUrl = `https://${ref}.supabase.co`;
  const redirectAllowList = [
    `${appOrigin}/`,
    `${appOrigin}/auth/callback`,
    `${appOrigin}/**`,
  ].join(",");

  console.log("Configuring auth redirect URLs...");
  await api(`/projects/${ref}/config/auth`, {
    method: "PATCH",
    body: JSON.stringify({
      site_url: appOrigin,
      uri_allow_list: redirectAllowList,
      mailer_autoconfirm: false,
    }),
  });

  let env = readFileSync(envPath, "utf8");
  env = upsertEnv(env, "SUPABASE_PROJECT_ID", ref);
  env = upsertEnv(env, "SUPABASE_URL", supabaseUrl);
  env = upsertEnv(env, "SUPABASE_PUBLISHABLE_KEY", publishable);
  env = upsertEnv(env, "VITE_SUPABASE_PROJECT_ID", ref);
  env = upsertEnv(env, "VITE_SUPABASE_URL", supabaseUrl);
  env = upsertEnv(env, "VITE_SUPABASE_PUBLISHABLE_KEY", publishable);
  if (serviceRole) env = upsertEnv(env, "SUPABASE_SERVICE_ROLE_KEY", serviceRole);
  writeFileSync(envPath, env, "utf8");

  const configToml = join(root, "supabase", "config.toml");
  writeFileSync(configToml, `project_id = "${ref}"\n`, "utf8");

  console.log(`
Done! Updated .env and supabase/config.toml.

Project URL: ${supabaseUrl}
Site URL:    ${appOrigin}
Redirects:   ${redirectAllowList}

Important:
- Existing users from the old Lovable Supabase project will NOT carry over.
- Sign up again on /auth with email/password on this new project.
- Restart the dev server: npm run dev
- Request a fresh email change after signing in.

Database password (save somewhere safe):
${dbPass}
`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
