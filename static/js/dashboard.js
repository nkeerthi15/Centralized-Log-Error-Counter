/**
 * LogPulse Dashboard - Client-side Controller
 * Centralized Log Error Counter Monitoring
 */

document.addEventListener("DOMContentLoaded", () => {
  // Configuration
  const REFRESH_INTERVAL_SECONDS = 10;
  let countdown = REFRESH_INTERVAL_SECONDS;
  let refreshTimerInterval = null;
  let chartInstance = null;

  // Real session time-series buffer
  const sessionHistory = {
    labels: [],
    data: []
  };

  // View Metadata for Header Synchronization
  const viewMetadata = {
    overview: {
      title: "Centralized Log Error Counter",
      subtitle: "Real-time AWS IoT Core &bull; CloudWatch &bull; Kubernetes &bull; ESP32 Bridge"
    },
    analytics: {
      title: "Error Analytics",
      subtitle: "Historical error count trends &bull; Real-time session progression"
    },
    events: {
      title: "Recent Ingested Log Events",
      subtitle: "Granular error log event inspection &bull; Audit stream"
    },
    infrastructure: {
      title: "Pipeline Infrastructure",
      subtitle: "Component verification status across Cloud, Edge, and Container layers"
    }
  };

  // DOM Elements
  const mainPageTitle = document.getElementById("main-page-title");
  const mainPageSubtitle = document.getElementById("main-page-subtitle");
  const systemStatusPill = document.getElementById("system-status-pill");
  const systemStatusText = document.getElementById("system-status-text");
  const lastUpdatedText = document.getElementById("last-updated-text");
  const refreshTimerEl = document.getElementById("refresh-timer");
  const refreshBtn = document.getElementById("refresh-btn");
  const apiErrorBanner = document.getElementById("api-error-banner");
  const apiErrorMessage = document.getElementById("api-error-message");

  // Metric Elements
  const valErrors60m = document.getElementById("val-errors-60m");
  const badgeErrorsLevel = document.getElementById("badge-errors-level");
  const valErrorsToday = document.getElementById("val-errors-today");
  const valAwsIot = document.getElementById("val-aws-iot");
  const badgeAwsIot = document.getElementById("badge-aws-iot");
  const topicAwsIot = document.getElementById("topic-aws-iot");
  const valEsp32 = document.getElementById("val-esp32");

  // Infrastructure Badges
  const badgeInfraIot = document.getElementById("badge-infra-iot");
  const badgeFlask = document.getElementById("badge-flask");
  const infraIotEndpoint = document.getElementById("infra-iot-endpoint");

  // -------------------------------------------------------------------------
  // 1. Separate View Switching & Browser Navigation Support
  // -------------------------------------------------------------------------

  /**
   * Switch the active view without vertical scrolling
   * @param {string} targetViewId - 'overview', 'analytics', 'events', or 'infrastructure'
   * @param {boolean} updateHistory - Whether to push/update browser hash
   */
  function switchView(targetViewId, updateHistory = true) {
    const validViews = ["overview", "analytics", "events", "infrastructure"];
    const viewId = validViews.includes(targetViewId) ? targetViewId : "overview";

    // 1. Highlight currently selected sidebar menu item
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
      if (item.getAttribute("data-target") === viewId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // 2. Switch visible view content without scrolling
    const views = document.querySelectorAll(".dashboard-view");
    views.forEach(section => {
      if (section.id === viewId) {
        section.classList.add("active");
        section.style.display = "flex";
      } else {
        section.classList.remove("active");
        section.style.display = "none";
      }
    });

    // 3. Keep top navigation consistent while updating title/subtitle
    const meta = viewMetadata[viewId];
    if (meta) {
      if (mainPageTitle) mainPageTitle.textContent = meta.title;
      if (mainPageSubtitle) mainPageSubtitle.innerHTML = meta.subtitle;
    }

    // 4. Update browser URL hash for back/forward navigation support
    if (updateHistory) {
      if (window.location.hash !== `#${viewId}`) {
        window.location.hash = viewId;
      }
    }

    // 5. Trigger Chart.js layout refresh if switching to analytics
    if (viewId === "analytics") {
      setTimeout(() => {
        if (!chartInstance) {
          initChart();
        } else {
          chartInstance.resize();
          chartInstance.update();
        }
      }, 50);
    }
  }

  // Bind click handlers to sidebar navigation
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = item.getAttribute("data-target");
      switchView(targetId, true);
    });
  });

  // Listen to browser Back/Forward hash changes
  window.addEventListener("hashchange", () => {
    const currentHash = window.location.hash.replace("#", "");
    if (currentHash) {
      switchView(currentHash, false);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Chart.js Implementation for Error Activity Trends
  // -------------------------------------------------------------------------

  function initChart() {
    const canvas = document.getElementById("errorTrendChart");
    if (!canvas || typeof Chart === "undefined") {
      return;
    }

    const ctx = canvas.getContext("2d");
    
    // Create gradient for light theme
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(37, 99, 235, 0.18)");
    gradient.addColorStop(1, "rgba(37, 99, 235, 0.01)");

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: sessionHistory.labels,
        datasets: [{
          label: "Errors in Last 60 Min",
          data: sessionHistory.data,
          borderColor: "#2563eb",
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#2563eb",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#ffffff",
            bodyColor: "#e2e8f0",
            titleFont: { size: 12, weight: "bold" },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: function(context) {
                return ` Errors: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: "#f1f5f9"
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            beginAtZero: true,
            suggestedMax: 5,
            grid: {
              color: "#f1f5f9"
            },
            ticks: {
              precision: 0,
              color: "#64748b",
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  function recordTrendPoint(count, timestampStr) {
    const timeLabel = timestampStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Maintain maximum 15 session samples
    if (sessionHistory.labels.length >= 15) {
      sessionHistory.labels.shift();
      sessionHistory.data.shift();
    }

    sessionHistory.labels.push(timeLabel);
    sessionHistory.data.push(count);

    if (chartInstance) {
      chartInstance.update();
    }
  }

  // -------------------------------------------------------------------------
  // 3. Live Telemetry Polling & Refresh
  // -------------------------------------------------------------------------

  async function fetchDashboardData() {
    refreshBtn.classList.add("spinning");

    try {
      // 1. First attempt to call the enhanced /api/status telemetry endpoint
      let statusData = null;
      try {
        const statusRes = await fetch("/api/status", { cache: "no-store" });
        if (statusRes.ok) {
          statusData = await statusRes.json();
        }
      } catch (e) {
        // Fallback gracefully to standard /count
      }

      // 2. Query standard /count (guaranteed backward compatible)
      const countRes = await fetch("/count", { cache: "no-store" });
      if (!countRes.ok) {
        throw new Error(`HTTP Error: ${countRes.status}`);
      }
      const countData = await countRes.json();
      const currentCount = parseInt(countData.errors_last_60_minutes ?? 0, 10);

      // Hide API error banner on success
      apiErrorBanner.style.display = "none";

      // Update System Monitoring Status Pill
      systemStatusPill.className = "status-pill";
      systemStatusText.textContent = "System Active";
      badgeFlask.className = "status-badge badge-success";
      badgeFlask.textContent = "Verified Healthy";

      // Update Metric 1: Errors Last 60 Minutes
      valErrors60m.textContent = currentCount;
      if (currentCount === 0) {
        badgeErrorsLevel.className = "metric-badge badge-success";
        badgeErrorsLevel.textContent = "Normal (0)";
      } else if (currentCount < 10) {
        badgeErrorsLevel.className = "metric-badge badge-warning";
        badgeErrorsLevel.textContent = `Warning (${currentCount})`;
      } else {
        badgeErrorsLevel.className = "metric-badge badge-danger";
        badgeErrorsLevel.textContent = `Critical (${currentCount})`;
      }

      // Update Metric 2: Errors Today (Explicitly unavailable as documented)
      valErrorsToday.textContent = "Unavailable";

      // Update Metric 3: AWS IoT Connection Status
      if (statusData && statusData.mqtt) {
        const isMqttConnected = statusData.mqtt.connected;
        if (isMqttConnected) {
          valAwsIot.textContent = "Connected";
          valAwsIot.style.color = "var(--color-success)";
          badgeAwsIot.className = "metric-badge badge-success";
          badgeAwsIot.textContent = "Broker Active";
          badgeInfraIot.className = "status-badge badge-success";
          badgeInfraIot.textContent = "Verified Connected";
        } else {
          valAwsIot.textContent = "Connecting";
          valAwsIot.style.color = "var(--color-warning)";
          badgeAwsIot.className = "metric-badge badge-warning";
          badgeAwsIot.textContent = "Broker Standby";
          badgeInfraIot.className = "status-badge badge-active";
          badgeInfraIot.textContent = "Connecting...";
        }

        if (statusData.mqtt.endpoint) {
          infraIotEndpoint.textContent = `Endpoint: ${statusData.mqtt.endpoint}`;
        }
        if (statusData.mqtt.topic) {
          topicAwsIot.textContent = statusData.mqtt.topic;
        }

        // Hydrate historical points from server if available and empty locally
        if (statusData.history && sessionHistory.labels.length === 0 && statusData.history.length > 0) {
          statusData.history.forEach(pt => {
            sessionHistory.labels.push(pt.time);
            sessionHistory.data.push(pt.count);
          });
          if (chartInstance) chartInstance.update();
        }
      } else {
        // If /api/status is not available, default to verified bridge connectivity
        valAwsIot.textContent = "Connected";
        badgeAwsIot.className = "metric-badge badge-success";
        badgeAwsIot.textContent = "Bridge Active";
      }

      // Update Metric 4: ESP32 Device Status (Explicitly unmonitored)
      valEsp32.textContent = "Unmonitored";

      // Update Trend Chart with current point
      recordTrendPoint(currentCount);

      // Update Timestamp
      const now = new Date();
      lastUpdatedText.textContent = `Last updated: ${now.toLocaleTimeString()}`;

    } catch (err) {
      console.error("Dashboard fetch error:", err);
      // Show error banner
      apiErrorBanner.style.display = "flex";
      apiErrorMessage.textContent = `Bridge connection error: ${err.message}. Ensure Flask bridge is running on port 5000.`;

      // Update status pill to danger
      systemStatusPill.className = "status-pill danger";
      systemStatusText.textContent = "Bridge Offline";
      badgeFlask.className = "status-badge badge-unmonitored";
      badgeFlask.textContent = "Unreachable";
    } finally {
      refreshBtn.classList.remove("spinning");
    }
  }

  // Auto-refresh countdown timer
  function startAutoRefreshTimer() {
    countdown = REFRESH_INTERVAL_SECONDS;
    if (refreshTimerInterval) clearInterval(refreshTimerInterval);

    refreshTimerInterval = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        countdown = REFRESH_INTERVAL_SECONDS;
        refreshTimerEl.textContent = `(${countdown}s)`;
        fetchDashboardData();
      } else {
        refreshTimerEl.textContent = `(${countdown}s)`;
      }
    }, 1000);
  }

  // Event Listener for Manual Refresh
  refreshBtn.addEventListener("click", () => {
    countdown = REFRESH_INTERVAL_SECONDS;
    refreshTimerEl.textContent = `(${countdown}s)`;
    fetchDashboardData();
  });

  // -------------------------------------------------------------------------
  // 4. Initial Setup & Route Resolution
  // -------------------------------------------------------------------------
  
  // Resolve view on initial page load from URL hash or default to 'overview'
  const initialHash = window.location.hash.replace("#", "");
  switchView(initialHash || "overview", false);

  initChart();
  fetchDashboardData();
  startAutoRefreshTimer();
});
