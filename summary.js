/**
 * 고객 DID /api/monitor/summary 호출
 */

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function deriveStatus(summary) {
  if (!summary || summary.ok === false) return "offline";
  const total = Number(summary.devices_total) || 0;
  const online = Number(summary.devices_online) || 0;
  if (total <= 0) return "healthy";
  const ratio = online / total;
  if (ratio >= 0.8) return "healthy";
  if (ratio > 0) return "degraded";
  return "degraded";
}

/**
 * @param {{ publicUrl?: string, monitorToken?: string }} inst
 * @param {string} defaultToken
 * @param {number} timeoutMs
 */
async function fetchInstanceSummary(inst, defaultToken, timeoutMs = 8000) {
  const base = normalizeBaseUrl(inst.publicUrl);
  const token = String(inst.monitorToken || defaultToken || "").trim();
  if (!base) {
    return {
      ok: false,
      error: "missing_public_url",
      status: "offline",
    };
  }
  if (!token) {
    return {
      ok: false,
      error: "missing_monitor_token",
      status: "offline",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/monitor/summary`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Monitor-Token": token,
      },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: body.detail || `http_${res.status}`,
        status: "offline",
        httpStatus: res.status,
      };
    }
    const summary = {
      ok: true,
      devices_total: Number(body.devices_total) || 0,
      devices_online: Number(body.devices_online) || 0,
      devices_offline: Number(body.devices_offline) || 0,
      campaigns: Number(body.campaigns) || 0,
      schedules: Number(body.schedules) || 0,
      contents: Number(body.contents) || 0,
    };
    return {
      ok: true,
      status: deriveStatus(summary),
      summary,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      error: err && err.name === "AbortError" ? "timeout" : "fetch_failed",
      status: "offline",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 인스턴스 목록에 라이브 요약을 붙이고, 브라우저로 토큰은 내려보내지 않음.
 */
async function enrichInstances(instances, options = {}) {
  const defaultToken = options.defaultToken || process.env.MONITOR_TOKEN || "";
  const timeoutMs = Number(options.timeoutMs) || 8000;
  const list = Array.isArray(instances) ? instances : [];

  const results = await Promise.all(
    list.map(async (raw) => {
      const inst = { ...raw };
      const hasToken = Boolean(String(inst.monitorToken || defaultToken || "").trim());
      const live = await fetchInstanceSummary(inst, defaultToken, timeoutMs);
      delete inst.monitorToken;

      inst.monitorConfigured = Boolean(inst.publicUrl) && hasToken;

      if (live.ok && live.summary) {
        inst.status = live.status;
        inst.metrics = {
          devicesTotal: live.summary.devices_total,
          devicesOnline: live.summary.devices_online,
          devicesOffline: live.summary.devices_offline,
          campaigns: live.summary.campaigns,
          schedules: live.summary.schedules,
          contents: live.summary.contents,
          lastSyncedAt: live.fetchedAt,
        };
        inst.summaryError = null;
      } else {
        inst.status = live.status || "offline";
        inst.summaryError = live.error || "fetch_failed";
        if (!inst.metrics) {
          inst.metrics = {
            devicesTotal: 0,
            devicesOnline: 0,
            devicesOffline: 0,
            lastSyncedAt: null,
          };
        }
      }
      return inst;
    })
  );

  return results;
}

module.exports = {
  fetchInstanceSummary,
  enrichInstances,
  deriveStatus,
};
