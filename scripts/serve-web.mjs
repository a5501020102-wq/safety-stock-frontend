// 本機靜態伺服器：提供 web/ 目錄，僅供開發與 E2E 使用（正式環境由 Vercel 提供）。
// 用法：node scripts/serve-web.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../web", import.meta.url)));
const DEFAULT_PORT = 3000;
const port = Number(process.argv[2] ?? process.env.PORT ?? DEFAULT_PORT);

// 與正式環境相同的安全標頭（取自 vercel.json），本機另外允許連到 localhost 的後端
const LOCAL_API_ORIGINS = "http://localhost:5000 http://127.0.0.1:5000";
const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const SECURITY_HEADERS = Object.fromEntries(
  vercelConfig.headers[0].headers.map(({ key, value }) => [
    key,
    key === "Content-Security-Policy" ? value.replace("connect-src 'self'", `connect-src 'self' ${LOCAL_API_ORIGINS}`) : value,
  ])
);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  const filePath = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname));
  // 阻擋 ../ 路徑穿越
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, () => console.log(`web/ 已啟動：http://localhost:${port}`));
