const API_BASE = "/api";
const API_TIMEOUT_MS = 3500;

const state = {
  programs: [],
  activeBoard: "All",
  runtimeMode: "checking"
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function setRuntimeBadge(mode, details) {
  state.runtimeMode = mode;
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

function setStatus(elementId, message, type) {
  const target = document.getElementById(elementId);
  if (!target) {
    return;
  }

  target.textContent = message;
  target.classList.remove("success", "error");
  if (type) {
    target.classList.add(type);
  }
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

async function fetchJson(path, options = {}) {
  return apiClient.request(path, options);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderPipelineChips(pipeline = []) {
  const host = document.getElementById("pipelineChips");
  if (!host) {
    return;
  }

  host.innerHTML = "";
  pipeline
    .filter((item) => item.count > 0)
    .slice(0, 5)
    .forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${item.status.replace(/_/g, " ")}: ${item.count}`;
      host.appendChild(chip);
    });

  if (!host.children.length) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "Pipeline is clean. Add your first lead.";
    host.appendChild(chip);
  }
}

function renderOverview(overview) {
  const mappings = [
    ["metricTotalLeads", overview.totalLeads],
    ["metricConversion", `${overview.conversionRate}%`],
    ["metricLeadScore", overview.averageLeadScore],
    ["metricTutors", overview.activeTutors]
  ];

  mappings.forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  });
}

function renderPrograms() {
  const host = document.getElementById("programGrid");
  if (!host) {
    return;
  }

  const filtered = state.programs.filter((program) => {
    if (state.activeBoard === "All") {
      return true;
    }
    return program.boards.includes(state.activeBoard);
  });

  if (!filtered.length) {
    host.innerHTML = "<p>No programs available for this board filter right now.</p>";
    return;
  }

  host.innerHTML = filtered
    .map(
      (program) => `
      <article class="program-card">
        <div class="program-top">
          <h3>${program.title}</h3>
          <strong>${currency.format(program.monthlyPriceInr)}/mo</strong>
        </div>
        <div class="program-meta">
          <span>Grades ${program.grades}</span>
          <span>${program.format}</span>
          <span>${program.boards.join(" / ")}</span>
        </div>
        <p>${program.description}</p>
        <ul>
          ${program.outcomes.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </article>
    `
    )
    .join("");
}

function renderSessions(sessions = []) {
  const host = document.getElementById("sessionList");
  if (!host) {
    return;
  }

  host.innerHTML = sessions
    .map(
      (session) => `
      <article class="session-card">
        <h3>${session.title}</h3>
        <p>${session.subject} · ${session.board}</p>
        <p>${formatDate(session.startsAt)} · ${session.tutor}</p>
      </article>
    `
    )
    .join("");
}

function bindProgramFilters() {
  document.querySelectorAll("[data-board-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeBoard = button.dataset.boardFilter;
      document
        .querySelectorAll("[data-board-filter]")
        .forEach((item) => item.classList.toggle("active", item === button));
      renderPrograms();
    });
  });
}

function renderLeadResult(payload) {
  const lead = payload.lead;
  const plan = lead.blueprint?.phases || [];

  const leadId = document.getElementById("resultLeadId");
  const leadScore = document.getElementById("resultLeadScore");
  const priority = document.getElementById("resultPriority");
  const tutor = document.getElementById("resultTutor");
  const nextAction = document.getElementById("resultNextAction");
  const timeline = document.getElementById("resultPlan");

  if (leadId) leadId.textContent = `Lead ID: ${lead.leadId}`;
  if (leadScore) leadScore.textContent = String(lead.score);
  if (priority) priority.textContent = lead.priority;
  if (tutor) {
    tutor.textContent =
      lead.assignedTutor?.tutorName || payload.backupTutors?.[0]?.tutorName || "Pending assignment";
  }
  if (nextAction) nextAction.textContent = lead.nextBestAction;

  if (timeline) {
    timeline.innerHTML = plan
      .map(
        (phase) => `
        <article>
          <h4>${phase.title} · ${phase.timeline}</h4>
          <p>${phase.focus}</p>
        </article>
      `
      )
      .join("");
  }
}

function formToObject(formElement) {
  return Object.fromEntries(new FormData(formElement).entries());
}

function bindTrialPlanner() {
  const form = document.getElementById("trialPlannerForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("trialPlannerStatus", "Generating intelligent blueprint...", null);

    try {
      const payload = formToObject(form);
      const result = await fetchJson("/leads", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      renderLeadResult(result);
      setStatus("trialPlannerStatus", "Blueprint generated and saved to pipeline.", "success");
      form.reset();
      await loadDashboardData();
    } catch (error) {
      setStatus("trialPlannerStatus", error.message, "error");
    }
  });
}

function bindTutorApplication() {
  const form = document.getElementById("tutorApplicationForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("tutorApplicationStatus", "Submitting profile...", null);

    try {
      const payload = formToObject(form);
      const result = await fetchJson("/tutor-applications", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setStatus(
        "tutorApplicationStatus",
        `Application ${result.application.applicationId} received (score ${result.application.profileScore}).`,
        "success"
      );
      form.reset();
      await loadDashboardData();
    } catch (error) {
      setStatus("tutorApplicationStatus", error.message, "error");
    }
  });
}

function bindContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("contactStatus", "Creating support ticket...", null);

    try {
      const payload = formToObject(form);
      const result = await fetchJson("/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setStatus("contactStatus", `Ticket ${result.ticket.ticketId} created.`, "success");
      form.reset();
      await loadDashboardData();
    } catch (error) {
      setStatus("contactStatus", error.message, "error");
    }
  });
}

function bindSimulator() {
  const baseline = document.getElementById("simBaseline");
  const hours = document.getElementById("simHours");
  const weeks = document.getElementById("simWeeks");

  if (!baseline || !hours || !weeks) {
    return;
  }

  const baselineLabel = document.getElementById("simBaselineValue");
  const hoursLabel = document.getElementById("simHoursValue");
  const weeksLabel = document.getElementById("simWeeksValue");

  let pendingTimer;

  const updateLabels = () => {
    baselineLabel.textContent = baseline.value;
    hoursLabel.textContent = `${hours.value} hrs`;
    weeksLabel.textContent = `${weeks.value} weeks`;
  };

  const runSimulation = async () => {
    updateLabels();

    try {
      const result = await fetchJson("/simulate-progress", {
        method: "POST",
        body: JSON.stringify({
          baselineScore: baseline.value,
          weeklyHours: hours.value,
          weeks: weeks.value
        })
      });

      const simulation = result.simulation;
      document.getElementById("simProjected").textContent = simulation.projectedScore;
      document.getElementById("simGain").textContent = `+${simulation.projectedGain}`;
      document.getElementById("simConfidence").textContent = `${simulation.confidence}%`;
      document.getElementById("simNarrative").textContent = simulation.narrative;
    } catch (error) {
      document.getElementById("simNarrative").textContent = error.message;
    }
  };

  [baseline, hours, weeks].forEach((input) => {
    input.addEventListener("input", () => {
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(runSimulation, 120);
    });
  });

  runSimulation();
}

async function loadPrograms() {
  const data = await fetchJson("/programs");
  state.programs = data.programs || [];
  renderPrograms();
}

async function loadDashboardData() {
  const [overviewData, pipelineData] = await Promise.all([
    fetchJson("/dashboard/overview"),
    fetchJson("/dashboard/pipeline")
  ]);

  renderOverview(overviewData.overview || {});
  renderPipelineChips(pipelineData.pipeline || []);
}

async function loadSessions() {
  const data = await fetchJson("/sessions/upcoming");
  renderSessions(data.sessions || []);
}

async function initialize() {
  setRuntimeBadge("checking");

  bindProgramFilters();
  bindTrialPlanner();
  bindTutorApplication();
  bindContactForm();
  bindSimulator();

  try {
    await Promise.all([loadPrograms(), loadDashboardData(), loadSessions()]);

    if (state.runtimeMode === "mock") {
      setStatus(
        "trialPlannerStatus",
        "Running in browser mode because live backend is unavailable on this host.",
        "error"
      );
    }
  } catch (error) {
    setStatus("trialPlannerStatus", "Unable to load app data. " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", initialize);
