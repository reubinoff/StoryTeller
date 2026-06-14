import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(rootDir, "build", "client");
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || "127.0.0.1";

const mimes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

if (!existsSync(buildDir)) {
  console.error("Missing build/client. Run `npm run build` first.");
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  let filePath = normalize(join(buildDir, pathname));

  if (!filePath.startsWith(buildDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath)) {
    filePath = join(buildDir, "__spa-fallback.html");
  }

  res.writeHead(200, {
    "Content-Type": mimes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  console.log(`Serving ${buildDir} at http://${host}:${port}`);
});
