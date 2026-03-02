const express = require("express");
const {
  buildBlueprint,
  calculateLeadScore,
  derivePriority,
  getNextBestAction,
  matchTutor,
  normalizeString,
  simulateProgress
} = require("./engine");
const { LEAD_STATUSES, PROGRAMS, TUTOR_POOL } = require("./constants");
const { readStore, updateStore } = require("./store");

const router = express.Router();

function requireFields(payload, fields) {
  return fields.filter((field) => {
    const value = payload[field];
    if (typeof value === "number") {
      return false;
    }
    return !normalizeString(value);
  });
}

function createLeadId(sequenceNumber) {
  const now = new Date();
  const dateToken = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `TH-${dateToken}-${String(sequenceNumber).padStart(4, "0")}`;
}

function summarizePipeline(leads) {
  return LEAD_STATUSES.map((status) => ({
    status,
    count: leads.filter((lead) => lead.status === status).length
  }));
}

function overviewFromStore(store) {
  const leads = store.leads || [];
  const enrolled = leads.filter((lead) => lead.status === "enrolled").length;
  const avgScore =
    leads.length === 0
      ? 0
      : Math.round(
          leads.reduce((sum, lead) => sum + (Number(lead.score) || 0), 0) / leads.length
        );

  return {
    totalLeads: leads.length,
    activeTutors: TUTOR_POOL.length,
    conversionRate: leads.length ? Math.round((enrolled / leads.length) * 100) : 0,
    averageLeadScore: avgScore,
    openApplications: (store.tutorApplications || []).filter(
      (application) => application.status === "received"
    ).length,
    responseSlaMinutes: leads.length ? 28 : 0
  };
}

function addActivity(store, type, message) {
  const item = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    message,
    createdAt: new Date().toISOString()
  };
  store.activity.unshift(item);
  store.activity = store.activity.slice(0, 80);
}

router.get("/health", (request, response) => {
  response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "TutorHive Relaunch API"
  });
});

router.get("/programs", (request, response) => {
  response.json({ programs: PROGRAMS });
});

router.get("/sessions/upcoming", (request, response) => {
  const store = readStore();
  response.json({
    sessions: (store.upcomingSessions || []).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  });
});

router.get("/dashboard/overview", (request, response) => {
  const store = readStore();
  response.json({ overview: overviewFromStore(store) });
});

router.get("/dashboard/pipeline", (request, response) => {
  const store = readStore();
  response.json({ pipeline: summarizePipeline(store.leads || []) });
});

router.get("/dashboard/recent-activity", (request, response) => {
  const store = readStore();
  response.json({ recentActivity: (store.activity || []).slice(0, 12) });
});

router.post("/simulate-progress", (request, response) => {
  const simulation = simulateProgress(request.body || {});
  response.json({ simulation });
});

router.post("/leads", (request, response) => {
  const payload = request.body || {};
  const missing = requireFields(payload, [
    "parentName",
    "studentName",
    "grade",
    "board",
    "subject",
    "weeklyHours",
    "preferredTime"
  ]);

  if (missing.length > 0) {
    response.status(400).json({
      error: "Missing required fields",
      missing
    });
    return;
  }

  const score = calculateLeadScore(payload);
  const priority = derivePriority(score);
  const blueprint = buildBlueprint(payload);
  const tutorMatch = matchTutor(payload, TUTOR_POOL);

  let savedLead;
  updateStore((store) => {
    const leadId = createLeadId((store.leads || []).length + 1);
    const lead = {
      leadId,
      parentName: normalizeString(payload.parentName),
      studentName: normalizeString(payload.studentName),
      grade: Number(payload.grade),
      board: normalizeString(payload.board),
      subject: normalizeString(payload.subject),
      weeklyHours: Number(payload.weeklyHours),
      preferredTime: normalizeString(payload.preferredTime),
      startInDays: Number(payload.startInDays) || 14,
      goals: normalizeString(payload.goals),
      score,
      priority,
      status: "new",
      assignedTutor: tutorMatch.primary,
      blueprint,
      nextBestAction: getNextBestAction(score),
      createdAt: new Date().toISOString()
    };

    store.leads.unshift(lead);
    savedLead = lead;

    addActivity(
      store,
      "lead",
      `${lead.leadId} created for ${lead.studentName} (${lead.subject}, score ${lead.score})`
    );

    return store;
  });

  response.status(201).json({
    message: "Lead captured and learning blueprint generated.",
    lead: savedLead,
    backupTutors: tutorMatch.backups
  });
});

router.post("/contact", (request, response) => {
  const payload = request.body || {};
  const missing = requireFields(payload, ["name", "email", "message"]);

  if (missing.length) {
    response.status(400).json({
      error: "Missing required fields",
      missing
    });
    return;
  }

  let saved;
  updateStore((store) => {
    saved = {
      ticketId: `CT-${Date.now()}`,
      name: normalizeString(payload.name),
      email: normalizeString(payload.email),
      phone: normalizeString(payload.phone),
      message: normalizeString(payload.message),
      createdAt: new Date().toISOString()
    };

    store.contacts.unshift(saved);
    addActivity(store, "contact", `New contact request from ${saved.name}`);
    return store;
  });

  response.status(201).json({
    message: "Support ticket created.",
    ticket: saved
  });
});

router.post("/tutor-applications", (request, response) => {
  const payload = request.body || {};
  const missing = requireFields(payload, [
    "name",
    "email",
    "subject",
    "experienceYears",
    "availability"
  ]);

  if (missing.length) {
    response.status(400).json({
      error: "Missing required fields",
      missing
    });
    return;
  }

  const experienceYears = Number(payload.experienceYears) || 0;
  const profileScore = Math.round(
    Math.min(
      95,
      50 + experienceYears * 4 + (normalizeString(payload.message).length > 80 ? 8 : 0)
    )
  );

  let saved;
  updateStore((store) => {
    saved = {
      applicationId: `TA-${Date.now()}`,
      name: normalizeString(payload.name),
      email: normalizeString(payload.email),
      phone: normalizeString(payload.phone),
      subject: normalizeString(payload.subject),
      experienceYears,
      availability: normalizeString(payload.availability),
      message: normalizeString(payload.message),
      profileScore,
      status: "received",
      createdAt: new Date().toISOString()
    };

    store.tutorApplications.unshift(saved);
    addActivity(
      store,
      "tutor",
      `Tutor application ${saved.applicationId} received (${saved.subject}, score ${saved.profileScore})`
    );

    return store;
  });

  response.status(201).json({
    message: "Tutor application submitted.",
    application: saved
  });
});

router.get("/admin/leads", (request, response) => {
  const store = readStore();
  response.json({
    leads: (store.leads || []).slice(0, 50),
    pipeline: summarizePipeline(store.leads || [])
  });
});

router.patch("/admin/leads/:leadId", (request, response) => {
  const { leadId } = request.params;
  const requestedStatus = normalizeString(request.body?.status);

  if (!LEAD_STATUSES.includes(requestedStatus)) {
    response.status(400).json({
      error: "Invalid status",
      allowedStatuses: LEAD_STATUSES
    });
    return;
  }

  let updatedLead = null;
  updateStore((store) => {
    const lead = store.leads.find((item) => item.leadId === leadId);
    if (!lead) {
      return store;
    }

    lead.status = requestedStatus;
    lead.updatedAt = new Date().toISOString();
    updatedLead = lead;

    addActivity(
      store,
      "pipeline",
      `${lead.leadId} moved to ${requestedStatus.replace(/_/g, " ")}`
    );

    return store;
  });

  if (!updatedLead) {
    response.status(404).json({ error: "Lead not found" });
    return;
  }

  response.json({
    message: "Lead status updated",
    lead: updatedLead
  });
});

module.exports = router;
