(function () {
  "use strict";

  const grid = document.getElementById("instance-grid");
  const alertRoot = document.getElementById("alert-root");
  const syncTimeEl = document.getElementById("sync-time");

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

  function renderCard(inst) {
    const online = inst.metrics?.devicesOnline ?? 0;
    const total = inst.metrics?.devicesTotal ?? 0;
    const p = pct(online, total);
    const railway = inst.railway || {};
    const r2 = inst.r2 || {};
    const mysql = inst.mysql || {};

    return (
      '<article class="card">' +
      '<div class="card__head">' +
      "<div>" +
      '<h3 class="card__title">' +
      escapeHtml(inst.label || "이름 없음") +
      "</h3>" +
      '<p class="card__id">' +
      escapeHtml(inst.id || "") +
      "</p>" +
      "</div>" +
      '<span class="status ' +
      statusClass(inst.status) +
      '">' +
      escapeHtml(statusLabel(inst.status)) +
      "</span>" +
      "</div>" +
      '<dl class="meta-block">' +
      '<div class="meta-row"><dt>Railway</dt><dd class="mono">' +
      escapeHtml([railway.projectName, railway.serviceName].filter(Boolean).join(" · ") || "—") +
      "</dd></div>" +
      '<div class="meta-row"><dt>공개 URL</dt><dd><div class="url-line">' +
      '<span class="mono">' +
      escapeHtml(inst.publicUrl || "—") +
      "</span>" +
      (inst.publicUrl
        ? '<button type="button" class="btn-copy" data-copy="' +
          escapeHtml(inst.publicUrl) +
          '">복사</button>'
        : "") +
      "</div></dd></div>" +
      '<div class="meta-row"><dt>R2</dt><dd class="mono">' +
      escapeHtml(r2.bucket || "—") +
      (r2.publicBaseUrl ? " · " + escapeHtml(r2.publicBaseUrl) : "") +
      "</dd></div>" +
      '<div class="meta-row"><dt>MySQL</dt><dd class="mono">' +
      escapeHtml(mysql.databaseName || "—") +
      "</dd></div>" +
      "</dl>" +
      '<div class="metrics">' +
      '<div class="metrics__row">' +
      '<div class="metric"><span class="metric__label">디바이스</span>' +
      '<span class="metric__value">' +
      escapeHtml(String(total)) +
      ' <small>대</small></span></div>' +
      '<div class="metric"><span class="metric__label">온라인</span>' +
      '<span class="metric__value">' +
      escapeHtml(String(online)) +
      ' <small>/ ' +
      escapeHtml(String(inst.metrics?.devicesOffline ?? 0)) +
      " 오프라인</small></span></div>" +
      '<div class="metric"><span class="metric__label">가동률</span>' +
      '<span class="metric__value">' +
      escapeHtml(String(p)) +
      "%</span></div>" +
      "</div>" +
      '<div class="bar" role="presentation"><div class="bar__fill" style="width:' +
      escapeHtml(String(p)) +
      '%"></div></div>' +
      '<p class="metrics__sync">마지막 동기화 · ' +
      escapeHtml(formatDate(inst.metrics?.lastSyncedAt)) +
      "</p>" +
      "</div>" +
      "</article>"
    );
  }

  function showError(msg) {
    alertRoot.hidden = false;
    alertRoot.innerHTML = '<div class="alert" role="alert">' + escapeHtml(msg) + "</div>";
  }

  function formatEnvLabel(raw) {
    const s = String(raw || "").trim().replace(/_/g, " ");
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
      return;
    }

    syncTimeEl.dateTime = data.updatedAt || "";
    syncTimeEl.textContent = "문서 기준 시각 · " + formatDate(data.updatedAt);

    const list = Array.isArray(data.instances) ? data.instances : [];
    if (list.length === 0) {
      grid.innerHTML = '<p class="empty">등록된 인스턴스가 없습니다. 데이터 소스를 연결하면 여기에 표시됩니다.</p>';
      return;
    }

    grid.innerHTML = list.map(renderCard).join("");

    requestAnimationFrame(() => {
      grid.querySelectorAll(".bar__fill").forEach((el) => {
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
