const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;

const dataPath = path.join(__dirname, "data", "instances.json");

function loadInstancesPayload() {
  const raw = fs.readFileSync(dataPath, "utf8");
  return JSON.parse(raw);
}

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.get("/api/config", (_req, res) => {
  const env =
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "production";
  res.json({ environment: env });
});

app.get("/api/instances", (_req, res) => {
  try {
    res.json(loadInstancesPayload());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "instances_load_failed" });
  }
});

app.get("/health", (_req, res) => {
  res.type("text/plain").send("ok");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`listening on ${port}`);
});
