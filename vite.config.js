import { defineConfig } from "vite";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "saves");
const AREAS = { state: "state", projects: "projects" };
const LIMIT = 96 * 1024 * 1024;

// A save name becomes a filename, so it is rebuilt from scratch rather than
// sanitised: anything outside the allowed characters is dropped, not escaped. There
// is no input that can produce a separator, a dot segment, or an absolute path.
const slug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

function resolveIn(area, name) {
  const dir = AREAS[area];
  if (!dir) return null;
  const file = path.join(ROOT, dir, `${slug(name)}.json`);
  // Belt and braces: slug() cannot escape, and this proves it for every path that
  // reaches the filesystem.
  const base = path.join(ROOT, dir) + path.sep;
  return file.startsWith(base) ? file : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let over = false;
    const parts = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        // Stop buffering but keep draining. Destroying the socket here would reach
        // the caller as a network error instead of a reason, and a save that fails
        // for a knowable cause should say so.
        over = true;
        parts.length = 0;
        return;
      }
      parts.push(chunk);
    });
    req.on("end", () =>
      over
        ? reject(
            Error(`Too large: ${(size / 1048576) | 0}MB exceeds the limit.`),
          )
        : resolve(Buffer.concat(parts).toString("utf8")),
    );
    req.on("error", reject);
  });
}

// Saving to a folder inside the repo means the dev server can write files, which is
// a local file-write primitive that any page in the browser could try to reach on
// localhost. Three things stand in the way:
//
//   1. It exists only while serving. `apply: "serve"` keeps it out of every build.
//   2. Every request must carry `x-boast`. Setting a custom header forces a CORS
//      preflight, and `server.cors` below answers one only for this dev server's own
//      origins, so a foreign page never gets to send the real request. A simple form
//      post, which needs no preflight, cannot set the header at all.
//   3. Origin, when present, must be this dev server — the check that still holds if
//      the CORS layer above ever changes.
//
// Preflights are answered by Vite's own middleware, which runs before any plugin's,
// so pinning `server.cors` is the lever that works; a check inside this handler
// would never see an OPTIONS request.
//
// Confinement is separate from all three: names are rebuilt from `[a-z0-9-]`, the
// area is chosen from a fixed map, and the extension is fixed.
function boastSaves() {
  return {
    name: "boast-saves",
    apply: "serve",
    configureServer(server) {
      const origins = new Set(
        [server.config.server.port ?? 5173].flatMap((p) => [
          `http://127.0.0.1:${p}`,
          `http://localhost:${p}`,
        ]),
      );
      server.middlewares.use("/__boast", async (req, res, next) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        if (req.headers["x-boast"] !== "1") return next();
        const origin = req.headers.origin;
        if (origin && !origins.has(origin))
          return send(403, { error: "origin" });
        const url = new URL(req.url, "http://localhost");
        const [, area, name] = url.pathname.split("/");
        try {
          if (url.pathname === "/ping") return send(200, { ok: true });
          if (!AREAS[area]) return send(404, { error: "unknown area" });
          const dir = path.join(ROOT, AREAS[area]);
          if (req.method === "GET" && !name) {
            const entries = await fs.readdir(dir).catch(() => []);
            return send(200, {
              names: entries
                .filter((f) => f.endsWith(".json"))
                .map((f) => f.slice(0, -5)),
            });
          }
          const file = resolveIn(area, name);
          if (!file) return send(400, { error: "bad name" });
          if (req.method === "GET") {
            const text = await fs.readFile(file, "utf8").catch(() => null);
            return text === null
              ? send(404, { error: "missing" })
              : send(200, { data: JSON.parse(text) });
          }
          if (req.method === "PUT") {
            const text = await readBody(req);
            JSON.parse(text); // never write something we cannot read back
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(file, text);
            return send(200, { saved: path.relative(process.cwd(), file) });
          }
          if (req.method === "DELETE") {
            await fs.rm(file, { force: true });
            return send(200, { ok: true });
          }
          return send(405, { error: "method" });
        } catch (e) {
          return send(400, { error: e.message });
        }
      });
    },
  };
}

const DEV_ORIGINS = [5173, 4173].flatMap((p) => [
  `http://127.0.0.1:${p}`,
  `http://localhost:${p}`,
]);
export default defineConfig({
  plugins: [boastSaves()],
  // Pinned rather than left to the default, because the save endpoint's first line of
  // defence is that a foreign page cannot pass its preflight.
  server: { cors: { origin: DEV_ORIGINS } },
});
