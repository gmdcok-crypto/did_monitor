const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowMockFallback =
  process.env.ALLOW_MOCK_INSTANCES === "1" ||
  process.env.NODE_ENV === "development";

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
  });
});

app.get("/api/instances", async (_req, res) => {
  try {
    if (db.hasMysqlConfig()) {
      const payload = await db.listInstances();
      return res.json(payload);
    }
    if (allowMockFallback) {
      return res.json(loadMockPayload());
    }
    return res.status(503).json({
      error: "mysql_not_configured",
      message: "MYSQL_URL(또는 MYSQLHOST 등)이 없습니다. Railway Variables를 확인하세요.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "instances_load_failed" });
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
