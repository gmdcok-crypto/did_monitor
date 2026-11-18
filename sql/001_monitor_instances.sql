-- did_monitor: 등록 고객(인스턴스) 메타
-- 비밀번호·토큰은 이 테이블에 넣지 마세요.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 예시 (실제 고객 값으로 교체):
-- INSERT INTO monitor_instances (
--   id, label, status,
--   railway_project_name, railway_service_name,
--   public_url, r2_bucket, mysql_database_name,
--   devices_total, devices_online, devices_offline, last_synced_at
-- ) VALUES (
--   'cust-001', '고객명', 'healthy',
--   'did-customer-x', 'web',
--   'https://example.up.railway.app', 'did-x-assets', 'railway',
--   0, 0, 0, UTC_TIMESTAMP()
-- );
