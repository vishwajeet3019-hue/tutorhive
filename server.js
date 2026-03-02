const compression = require("compression");
const express = require("express");
const path = require("node:path");

const apiRouter = require("./server/api");
const { ensureStore } = require("./server/store");

const app = express();
const PORT = Number(process.env.PORT) || 4173;
const TRUST_PROXY = ["1", "true", "yes"].includes(
  String(process.env.TRUST_PROXY || "").toLowerCase()
);
const RATE_LIMIT_PER_MINUTE = Math.max(60, Number(process.env.RATE_LIMIT_PER_MINUTE) || 180);
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

ensureStore();

if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

const requestWindow = {
  resetAt: Date.now() + 60_000,
  counts: new Map()
};

function apiRateLimit(request, response, next) {
  const now = Date.now();
  if (now > requestWindow.resetAt) {
    requestWindow.resetAt = now + 60_000;
    requestWindow.counts.clear();
  }

  const key = request.ip || "unknown";
  const count = requestWindow.counts.get(key) || 0;

  if (count > RATE_LIMIT_PER_MINUTE) {
    response.status(429).json({ error: "Too many API requests. Retry in a minute." });
    return;
  }

  requestWindow.counts.set(key, count + 1);
  next();
}

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((request, response, next) => {
  response.setHeader("X-App", "TutorHive-Relaunch");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");

  if (request.path.startsWith("/api/")) {
    const origin = request.headers.origin;

    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
      }

      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.setHeader("Access-Control-Max-Age", "600");

      if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
      }
    }
  }

  next();
});

app.use("/api", apiRateLimit, apiRouter);

const staticRoot = process.cwd();
app.use(express.static(staticRoot, { extensions: ["html"] }));

app.get("/admin", (request, response) => {
  response.sendFile(path.join(staticRoot, "admin.html"));
});

app.get("*", (request, response, next) => {
  if (request.path.startsWith("/api/")) {
    next();
    return;
  }

  response.sendFile(path.join(staticRoot, "index.html"));
});

app.use((request, response) => {
  if (request.path.startsWith("/api/")) {
    response.status(404).json({ error: "API route not found" });
    return;
  }

  response.status(404).sendFile(path.join(staticRoot, "index.html"));
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  response.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? error.message : undefined
  });
});

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TutorHive relaunch running on http://localhost:${PORT}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down TutorHive server...`);
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
