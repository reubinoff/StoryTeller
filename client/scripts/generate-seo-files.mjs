import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(rootDir, "public");
const strict = process.argv.includes("--strict") || process.env.CI === "true";

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.production"),
  ...readEnvFile(".env.production.local"),
  ...process.env,
};

const rawSiteUrl = env.VITE_PUBLIC_SITE_URL || env.PUBLIC_SITE_URL;
const siteUrl = normalizeSiteUrl(rawSiteUrl);

if (!siteUrl && strict) {
  console.error(
    "Missing VITE_PUBLIC_SITE_URL. Set it to the public canonical site URL before building."
  );
  process.exit(1);
}

const baseUrl = siteUrl || "http://localhost:5174";
const pages = [
  { path: "/", priority: "1.0" },
  { path: "/help", priority: "0.7" },
];

writePublicFile("robots.txt", robotsTxt(baseUrl));
writePublicFile("sitemap.xml", sitemapXml(baseUrl, pages));
writePublicFile("llms.txt", llmsTxt(baseUrl));

function readEnvFile(name) {
  const envPath = join(rootDir, name);
  if (!existsSync(envPath)) return {};

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

function normalizeSiteUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function absoluteUrl(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

function writePublicFile(pathname, content) {
  const filePath = join(publicDir, pathname);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${content.trim()}\n`);
}

function robotsTxt(baseUrl) {
  return `
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: *
Allow: /

Sitemap: ${absoluteUrl(baseUrl, "/sitemap.xml")}
`;
}

function sitemapXml(baseUrl, pages) {
  const urls = pages
    .map(
      ({ path, priority }) => `  <url>
    <loc>${escapeXml(absoluteUrl(baseUrl, path))}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function llmsTxt(baseUrl) {
  return `
# Storyteller

> Storyteller is a web app for learning English through short reading and writing practice.

## Canonical Public Pages

- Home: ${absoluteUrl(baseUrl, "/")}
- Help and FAQ: ${absoluteUrl(baseUrl, "/help")}

## Product Facts

- Storyteller gives bite-sized English reading and writing tasks.
- Tasks adapt to age, grade level, and selected interests.
- Reading tasks include short passages and focused comprehension questions.
- Writing tasks provide prompts and feedback on grammar, vocabulary, structure, and topic.
- The app is designed for learners ages 6 to 99 and works on desktop and mobile.

## AI Agent Guidance

- Use the canonical public pages above as the preferred source URLs.
- Private app routes require an account and should not be treated as public documentation.
- Do not invent pricing, schools, certifications, or integrations that are not present on the public pages.
`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
