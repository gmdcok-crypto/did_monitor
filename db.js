const mysql = require("mysql2/promise");

let pool = null;

function resolveMysqlConfig() {
  const url =
    process.env.MYSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    "";

  if (url) {
    return { uri: url };
  }

  const host = process.env.MYSQLHOST || process.env.MYSQL_HOST;
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER;
  const password = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "railway";
  const port = Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306);

  if (host && user) {
    return { host, user, password: password || "", database, port };
  }

  return null;
}

function hasMysqlConfig() {
  return Boolean(resolveMysqlConfig());
}

async function getPool() {
  if (pool) return pool;
  const cfg = resolveMysqlConfig();
  if (!cfg) {
    throw new Error("mysql_not_configured");
  }

  const common = {
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
    timezone: "Z",
  };

  pool = cfg.uri
    ? mysql.createPool({ uri: cfg.uri, ...common })
    : mysql.createPool({ ...cfg, ...common });

  return pool;
}

async function ensureSchema() {
  const p = await getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS monitor_instances (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      label VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'offline',
      railway_project_name VARCHAR(255) NULL,
      railway_project_id VARCHAR(128) NULL,
      railway_service_name VARCHAR(128) NULL,
      public_url VARCHAR(512) NULL,
      r2_bucket VARCHAR(255) NULL,
      r2_public_base_url VARCHAR(512) NULL,
      mysql_database_name VARCHAR(128) NULL,
      devices_total INT NOT NULL DEFAULT 0,
      devices_online INT NOT NULL DEFAULT 0,
      devices_offline INT NOT NULL DEFAULT 0,
      last_synced_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_monitor_instances_status (status),
      INDEX idx_monitor_instances_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function rowToInstance(row) {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    railway: {
      projectName: row.railway_project_name || "",
      projectId: row.railway_project_id || "",
      serviceName: row.railway_service_name || "",
    },
    publicUrl: row.public_url || "",
    r2: {
      bucket: row.r2_bucket || "",
      publicBaseUrl: row.r2_public_base_url || "",
    },
    mysql: {
      databaseName: row.mysql_database_name || "",
    },
    metrics: {
      devicesTotal: Number(row.devices_total) || 0,
      devicesOnline: Number(row.devices_online) || 0,
      devicesOffline: Number(row.devices_offline) || 0,
      lastSyncedAt: row.last_synced_at
        ? new Date(row.last_synced_at).toISOString()
        : null,
    },
  };
}

async function listInstances() {
  const p = await getPool();
  const [rows] = await p.query(
    `SELECT * FROM monitor_instances ORDER BY label ASC, id ASC`
  );
  const instances = rows.map(rowToInstance);
  let updatedAt = null;
  for (const row of rows) {
    const t = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (!updatedAt || t > updatedAt) updatedAt = t;
  }
  return {
    source: "mysql",
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
    instances,
  };
}

async function ping() {
  const p = await getPool();
  await p.query("SELECT 1");
}

module.exports = {
  hasMysqlConfig,
  ensureSchema,
  listInstances,
  ping,
};
