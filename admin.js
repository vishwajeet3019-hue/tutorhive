const API_BASE = "/api";
const API_TIMEOUT_MS = 3500;
const STATUSES = [
  "new",
  "qualified",
  "trial_scheduled",
  "trial_done",
  "enrolled",
  "paused",
  "lost"
];

function setRuntimeBadge(mode, details) {
  const badge = document.getElementById("runtimeBadge");
  if (!badge) {
    return;
  }

  badge.classList.remove("api", "mock");

  if (mode === "api") {
    badge.classList.add("api");
    badge.textContent = "Runtime: Live API";
    return;
  }

  if (mode === "mock") {
    badge.classList.add("mock");
    badge.textContent = details || "Runtime: Browser Mode";
    return;
  }

  badge.textContent = "Checking runtime...";
}

function createApiClient() {
  let forceMockMode = false;

  async function request(path, options = {}) {
    const mockApi = window.TutorHiveMockApi;
    if (forceMockMode && mockApi) {
      return mockApi.request(path, options);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          "Content-Type": "application/json"
        },
        ...options,
        signal: controller.signal
      });

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      const isJson = contentType.includes("application/json");
      const payload = isJson ? await response.json().catch(() => ({})) : {};

      if (!response.ok) {
        const shouldFallback =
          Boolean(mockApi) &&
          (response.status === 404 || response.status >= 500 || !isJson || response.status === 405);

        if (shouldFallback) {
          forceMockMode = true;
          setRuntimeBadge("mock", "Runtime: Browser Mode");
          return mockApi.request(path, options);
        }

        throw new Error(payload.error || `Request failed (${response.status})`);
      }

      if (!isJson) {
        if (mockApi) {
          forceMockMode = true;
          setRuntimeBadge("mock", "Runtime: Browser Mode");
          return mockApi.request(path, options);
        }

        throw new Error("Unexpected response format from backend.");
      }

      setRuntimeBadge("api");
      return payload;
    } catch (error) {
      const networkIssue =
        error.name === "AbortError" ||
        /Failed to fetch|NetworkError|Load failed|terminated/i.test(String(error.message));

      if (mockApi && networkIssue) {
        forceMockMode = true;
        setRuntimeBadge("mock", "Runtime: Browser Mode");
        return mockApi.request(path, options);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { request };
}

const apiClient = createApiClient();

async function request(path, options = {}) {
  return apiClient.request(path, options);
}

function setStatus(message, type) {
  const status = document.getElementById("leadStatus");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.remove("success", "error");
  if (type) {
    status.classList.add(type);
  }
}

function renderOverview(overview) {
  const host = document.getElementById("overviewStats");
  if (!host) {
    return;
  }

  const cards = [
    ["Total Leads", overview.totalLeads],
    ["Conversion", `${overview.conversionRate}%`],
    ["Avg Lead Score", overview.averageLeadScore],
    ["Active Tutors", overview.activeTutors],
    ["Open Tutor Apps", overview.openApplications],
    ["Response SLA", `${overview.responseSlaMinutes} min`]
  ];

  host.innerHTML = cards
    .map(
      ([label, value]) => `
      <article>
        <p>${label}</p>
        <strong>${value}</strong>
      </article>
    `
    )
    .join("");
}

function renderPipeline(pipeline) {
  const host = document.getElementById("pipelineList");
  if (!host) {
    return;
  }

  host.innerHTML = pipeline
    .map(
      (item) => `
      <div class="item">
        <strong>${item.status.replace(/_/g, " ")}</strong>
        <p>${item.count} leads</p>
      </div>
    `
    )
    .join("");
}

function renderActivity(activity) {
  const host = document.getElementById("activityList");
  if (!host) {
    return;
  }

  host.innerHTML = activity
    .map(
      (item) => `
      <div class="item">
        <strong>${item.type}</strong>
        <p>${item.message}</p>
      </div>
    `
    )
    .join("");
}

function createStatusSelect(lead) {
  const select = document.createElement("select");

  STATUSES.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status.replace(/_/g, " ");
    option.selected = status === lead.status;
    select.appendChild(option);
  });

  select.addEventListener("change", async () => {
    try {
      setStatus(`Updating ${lead.leadId}...`, null);
      await request(`/admin/leads/${lead.leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value })
      });
      setStatus(`Lead ${lead.leadId} updated to ${select.value}.`, "success");
      await loadDashboard();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  return select;
}

function renderLeads(leads) {
  const tbody = document.getElementById("leadRows");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";
  leads.forEach((lead) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${lead.leadId}</td>
      <td>${lead.studentName} <br /><small>${lead.parentName}</small></td>
      <td>${lead.subject}</td>
      <td>${lead.score}</td>
      <td>${lead.priority}</td>
      <td></td>
      <td>${lead.assignedTutor?.tutorName || "Pending"}</td>
    `;

    row.children[5].appendChild(createStatusSelect(lead));
    tbody.appendChild(row);
  });
}

async function loadDashboard() {
  const [overviewData, leadData, pipelineData, activityData] = await Promise.all([
    request("/dashboard/overview"),
    request("/admin/leads"),
    request("/dashboard/pipeline"),
    request("/dashboard/recent-activity")
  ]);

  renderOverview(overviewData.overview || {});
  renderLeads(leadData.leads || []);
  renderPipeline(pipelineData.pipeline || []);
  renderActivity(activityData.recentActivity || []);
}

function bindRefresh() {
  const button = document.getElementById("refreshButton");
  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    setStatus("Refreshing data...", null);
    try {
      await loadDashboard();
      setStatus("Dashboard refreshed.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

async function init() {
  setRuntimeBadge("checking");
  bindRefresh();

  try {
    await loadDashboard();
    if (document.getElementById("runtimeBadge")?.classList.contains("mock")) {
      setStatus("Running in browser mode because live backend is unavailable on this host.", "error");
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
