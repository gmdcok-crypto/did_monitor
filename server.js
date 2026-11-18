const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const { enrichInstances } = require("./summary");

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowMockFallback =
  process.env.ALLOW_MOCK_INSTANCES === "1" ||
  process.env.NODE_ENV === "development";
const liveSummary =
  process.env.MONITOR_LIVE_SUMMARY !== "0"; // 기본 ON

const dataPath = path.join(__dirname, "data", "instances.json");

function loadMockPayload() {
  const raw = fs.readFileSync(dataPath, "utf8");
  const parsed = JSON.parse(raw);
  return { source: "mock", ...parsed };
}

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.get("/api/config", (_req, res) => {
  const env =
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "production";
  res.json({
    environment: env,
    dataSource: db.hasMysqlConfig() ? "mysql" : allowMockFallback ? "mock" : "none",
    liveSummary,
    monitorTokenConfigured: Boolean(String(process.env.MONITOR_TOKEN || "").trim()),
  });
});

async function buildInstancesPayload() {
  let payload;
  if (db.hasMysqlConfig()) {
    payload = await db.listInstances();
  } else if (allowMockFallback) {
    payload = loadMockPayload();
  } else {
    const err = new Error("mysql_not_configured");
    err.code = "mysql_not_configured";
    throw err;
  }

  if (!liveSummary) {
    payload.instances = (payload.instances || []).map((inst) => {
      const copy = { ...inst };
      delete copy.monitorToken;
      copy.monitorConfigured = Boolean(
        copy.publicUrl &&
          (inst.monitorToken || process.env.MONITOR_TOKEN)
      );
      return copy;
    });
    return payload;
  }

  const enriched = await enrichInstances(payload.instances || []);
  if (db.hasMysqlConfig()) {
    await Promise.all(
      enriched.map((inst) => db.saveLiveMetrics(inst).catch((e) => console.error(e)))
    );
  }
  return {
    ...payload,
    updatedAt: new Date().toISOString(),
    live: true,
    instances: enriched,
  };
}

app.get("/api/instances", async (_req, res) => {
  try {
    const payload = await buildInstancesPayload();
    return res.json(payload);
  } catch (err) {
    if (err && err.code === "mysql_not_configured") {
      return res.status(503).json({
        error: "mysql_not_configured",
        message: "MYSQL_URL(또는 MYSQLHOST 등)이 없습니다. Railway Variables를 확인하세요.",
      });
    }
    console.error(err);
    res.status(500).json({ error: "instances_load_failed" });
  }
});

app.post("/api/instances/sync", async (_req, res) => {
  try {
    const payload = await buildInstancesPayload();
    return res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "instances_sync_failed" });
  }
});

app.get("/health", async (_req, res) => {
  if (!db.hasMysqlConfig()) {
    return res.type("text/plain").send(allowMockFallback ? "ok-mock" : "ok-no-db");
  }
  try {
    await db.ping();
    res.type("text/plain").send("ok");
  } catch (err) {
    console.error(err);
    res.status(503).type("text/plain").send("db-unavailable");
  }
});

async function start() {
  if (db.hasMysqlConfig()) {
    try {
      await db.ensureSchema();
      console.log("mysql schema ready");
    } catch (err) {
      console.error("mysql schema init failed", err);
    }
  } else {
    console.warn(
      "MYSQL_URL not set — " +
        (allowMockFallback ? "using local mock JSON" : "instances API will return 503")
    );
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`listening on ${port}`);
  });
}

start();
