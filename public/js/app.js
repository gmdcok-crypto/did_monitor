(function () {
  "use strict";

  const grid = document.getElementById("instance-grid");
  const alertRoot = document.getElementById("alert-root");
  const syncTimeEl = document.getElementById("sync-time");
  const rowCountEl = document.getElementById("row-count");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return "—";
    }
  }

  function statusClass(status) {
    if (status === "healthy") return "status--healthy";
    if (status === "degraded") return "status--degraded";
    return "status--offline";
  }

  function statusLabel(status) {
    if (status === "healthy") return "정상";
    if (status === "degraded") return "주의";
    return "오프라인";
  }

  function pct(online, total) {
    if (!total || total <= 0) return 0;
    return Math.round((online / total) * 1000) / 10;
  }

  function renderRow(inst) {
    const online = inst.metrics?.devicesOnline ?? 0;
    const offline = inst.metrics?.devicesOffline ?? 0;
    const total = inst.metrics?.devicesTotal ?? 0;
    const p = pct(online, total);
    const railway = inst.railway || {};
    const r2 = inst.r2 || {};
    const mysql = inst.mysql || {};
    const railwayLabel =
      [railway.projectName, railway.serviceName].filter(Boolean).join(" / ") || "—";

    return (
      "<tr>" +
      '<td><div class="cell-customer">' +
      '<span class="cell-customer__name">' +
      escapeHtml(inst.label || "이름 없음") +
      "</span>" +
      '<span class="cell-customer__id">' +
      escapeHtml(inst.id || "") +
      "</span></div></td>" +
      "<td><span class=\"status " +
      statusClass(inst.status) +
      '">' +
      escapeHtml(statusLabel(inst.status)) +
      "</span></td>" +
      '<td><span class="mono cell-clip" title="' +
      escapeHtml(railwayLabel) +
      '">' +
      escapeHtml(railwayLabel) +
      "</span></td>" +
      "<td><div class=\"cell-url\">" +
      '<span class="mono" title="' +
      escapeHtml(inst.publicUrl || "") +
      '">' +
      escapeHtml(inst.publicUrl || "—") +
      "</span>" +
      (inst.publicUrl
        ? '<button type="button" class="btn-copy" data-copy="' +
          escapeHtml(inst.publicUrl) +
          '">복사</button>'
        : "") +
      "</div></td>" +
      '<td><span class="mono cell-clip" title="' +
      escapeHtml(r2.bucket || "") +
      '">' +
      escapeHtml(r2.bucket || "—") +
      "</span></td>" +
      '<td><span class="mono">' +
      escapeHtml(mysql.databaseName || "—") +
      "</span></td>" +
      '<td class="num">' +
      escapeHtml(String(total)) +
      "</td>" +
      '<td class="num">' +
      escapeHtml(String(online)) +
      "</td>" +
      '<td class="num">' +
      escapeHtml(String(offline)) +
      "</td>" +
      '<td class="num"><div class="uptime">' +
      "<span>" +
      escapeHtml(String(p)) +
      "%</span>" +
      '<span class="uptime__bar" role="presentation"><span class="uptime__fill" style="width:' +
      escapeHtml(String(p)) +
      '%"></span></span>' +
      "</div></td>" +
      '<td><span class="mono">' +
      escapeHtml(formatDate(inst.metrics?.lastSyncedAt)) +
      "</span></td>" +
      "</tr>"
    );
  }

  function renderTable(list) {
    return (
      '<table class="erp-table">' +
      "<thead><tr>" +
      "<th>고객</th>" +
      "<th>상태</th>" +
      "<th>Railway</th>" +
      "<th>공개 URL</th>" +
      "<th>R2 버킷</th>" +
      "<th>MySQL</th>" +
      '<th class="num">디바이스</th>' +
      '<th class="num">온라인</th>' +
      '<th class="num">오프라인</th>' +
      '<th class="num">가동률</th>' +
      "<th>동기화</th>" +
      "</tr></thead>" +
      "<tbody>" +
      list.map(renderRow).join("") +
      "</tbody></table>"
    );
  }

  function showError(msg) {
    alertRoot.hidden = false;
    alertRoot.innerHTML = '<div class="alert" role="alert">' + escapeHtml(msg) + "</div>";
  }

  function formatEnvLabel(raw) {
    const s = String(raw || "")
      .trim()
      .replace(/_/g, " ");
    if (!s) return "Production";
    return s
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) return;
      const cfg = await res.json();
      const pill = document.getElementById("env-pill");
      if (pill && cfg.environment) pill.textContent = formatEnvLabel(cfg.environment);
    } catch {
      /* keep default */
    }
  }

  async function load() {
    loadConfig();
    let data;
    try {
      const res = await fetch("/api/instances", { cache: "no-store" });
      if (!res.ok) throw new Error("API 응답 오류");
      data = await res.json();
    } catch {
      showError("인스턴스 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      grid.innerHTML =
        '<p class="empty">데이터를 표시할 수 없습니다. 서버 로그를 확인해 주세요.</p>';
      if (rowCountEl) rowCountEl.textContent = "0건";
      return;
    }

    syncTimeEl.dateTime = data.updatedAt || "";
    const sourceLabel = data.source === "mysql" ? "MySQL" : data.source === "mock" ? "목업" : "데이터";
    syncTimeEl.textContent = sourceLabel + " · " + formatDate(data.updatedAt);

    const list = Array.isArray(data.instances) ? data.instances : [];
    if (rowCountEl) rowCountEl.textContent = list.length + "건";

    if (list.length === 0) {
      grid.innerHTML =
        data.source === "mysql"
          ? '<p class="empty">MySQL <code>monitor_instances</code> 테이블에 등록된 고객이 없습니다. 고객 행을 INSERT 하면 이 표에 표시됩니다.</p>'
          : '<p class="empty">등록된 인스턴스가 없습니다. 데이터 소스를 연결하면 여기에 표시됩니다.</p>';
      return;
    }

    grid.innerHTML = renderTable(list);

    requestAnimationFrame(() => {
      grid.querySelectorAll(".uptime__fill").forEach((el) => {
        const w = el.style.width;
        el.style.width = "0%";
        requestAnimationFrame(() => {
          el.style.width = w;
        });
      });
    });
  }

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn || !(btn instanceof HTMLButtonElement)) return;
    const text = btn.getAttribute("data-copy");
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        const prev = btn.textContent;
        btn.textContent = "복사됨";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1600);
      },
      () => {
        btn.textContent = "실패";
        setTimeout(() => {
          btn.textContent = "복사";
        }, 1600);
      }
    );
  });

  load();
})();
