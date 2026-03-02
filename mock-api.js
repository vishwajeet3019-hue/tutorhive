(function bootstrapTutorHiveMockApi() {
  const STORAGE_KEY = "tutorhive_mock_store_v1";
  const LEAD_STATUSES = [
    "new",
    "qualified",
    "trial_scheduled",
    "trial_done",
    "enrolled",
    "paused",
    "lost"
  ];

  const PROGRAMS = [
    {
      id: "foundation-accelerator",
      title: "Foundation Accelerator",
      boards: ["CBSE", "ICSE"],
      grades: "3-8",
      format: "3 live sessions/week",
      monthlyPriceInr: 4200,
      description:
        "Core math + science acceleration with weekly diagnostics and parent briefings.",
      outcomes: [
        "Faster concept clarity",
        "Stronger homework completion",
        "Weekly mastery report"
      ]
    },
    {
      id: "global-curriculum-lab",
      title: "Global Curriculum Lab",
      boards: ["IGCSE", "IB"],
      grades: "4-10",
      format: "2 concept classes + 1 applied lab/week",
      monthlyPriceInr: 6100,
      description:
        "Inquiry-driven tutoring for IB and IGCSE learners with rubric-oriented mentoring.",
      outcomes: [
        "Rubric-ready written responses",
        "Applied project guidance",
        "Assessment strategy coaching"
      ]
    },
    {
      id: "future-coders-studio",
      title: "Future Coders Studio",
      boards: ["CBSE", "ICSE", "IGCSE", "IB"],
      grades: "5-10",
      format: "2 live builds/week + challenge sprint",
      monthlyPriceInr: 5200,
      description:
        "Project-first coding track from logic design to Python/JS apps and AI literacy.",
      outcomes: [
        "Portfolio-grade projects",
        "Problem-solving under constraints",
        "Presentation-ready demos"
      ]
    },
    {
      id: "exam-readiness-sprint",
      title: "Exam Readiness Sprint",
      boards: ["CBSE", "ICSE"],
      grades: "6-10",
      format: "4-week intensive",
      monthlyPriceInr: 3500,
      description:
        "Rapid revision program with topic diagnostics, smart worksheets, and timed drills.",
      outcomes: [
        "Targeted weak-topic fixes",
        "Timed paper confidence",
        "Daily revision rhythm"
      ]
    }
  ];

  const TUTORS = [
    {
      id: "T-101",
      name: "Riya Kulkarni",
      subjects: ["Mathematics", "Science"],
      gradeBand: [4, 8],
      experienceYears: 7,
      rating: 4.9,
      availability: ["Weekday Evening", "Weekend Morning"]
    },
    {
      id: "T-118",
      name: "Arjun Menon",
      subjects: ["Coding", "Mathematics"],
      gradeBand: [5, 10],
      experienceYears: 6,
      rating: 4.8,
      availability: ["Weekday Evening", "Weekend Afternoon"]
    },
    {
      id: "T-124",
      name: "Nandini Rao",
      subjects: ["English", "Social Studies"],
      gradeBand: [3, 9],
      experienceYears: 8,
      rating: 4.9,
      availability: ["Weekday Afternoon", "Weekend Morning"]
    },
    {
      id: "T-132",
      name: "Vikram Das",
      subjects: ["Science", "Mathematics"],
      gradeBand: [6, 10],
      experienceYears: 9,
      rating: 4.7,
      availability: ["Weekday Morning", "Weekday Evening"]
    },
    {
      id: "T-149",
      name: "Megha Bhat",
      subjects: ["Hindi", "English"],
      gradeBand: [2, 8],
      experienceYears: 5,
      rating: 4.8,
      availability: ["Weekday Afternoon", "Weekend Evening"]
    }
  ];

  const UPCOMING_SESSIONS = [
    {
      sessionId: "S-9001",
      title: "Fraction Fluency Drill",
      subject: "Mathematics",
      board: "CBSE",
      startsAt: "2026-03-03T11:30:00.000Z",
      tutor: "Riya Kulkarni"
    },
    {
      sessionId: "S-9002",
      title: "Creative Writing Studio",
      subject: "English",
      board: "ICSE",
      startsAt: "2026-03-03T13:00:00.000Z",
      tutor: "Nandini Rao"
    },
    {
      sessionId: "S-9003",
      title: "Scratch to Python Bridge",
      subject: "Coding",
      board: "IGCSE",
      startsAt: "2026-03-04T10:00:00.000Z",
      tutor: "Arjun Menon"
    },
    {
      sessionId: "S-9004",
      title: "Human Body Systems Deep Dive",
      subject: "Science",
      board: "IB",
      startsAt: "2026-03-05T12:45:00.000Z",
      tutor: "Vikram Das"
    }
  ];

  function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function defaultStore() {
    const timestamp = nowIso();
    return {
      createdAt: timestamp,
      updatedAt: timestamp,
      leads: [],
      contacts: [],
      tutorApplications: [],
      activity: [
        {
          id: "ACT-MOCK-BOOT",
          type: "platform",
          message: "TutorHive browser runtime initialized",
          createdAt: timestamp
        }
      ],
      upcomingSessions: UPCOMING_SESSIONS
    };
  }

  function parseStore(raw) {
    try {
      const parsed = JSON.parse(raw);
      const initial = defaultStore();
      return {
        ...initial,
        ...parsed,
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
        contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
        tutorApplications: Array.isArray(parsed.tutorApplications) ? parsed.tutorApplications : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : initial.activity,
        upcomingSessions: Array.isArray(parsed.upcomingSessions)
          ? parsed.upcomingSessions
          : initial.upcomingSessions
      };
    } catch (error) {
      return defaultStore();
    }
  }

  function readStore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultStore();
      }
      return parseStore(raw);
    } catch (error) {
      return defaultStore();
    }
  }

  function writeStore(store) {
    const nextStore = {
      ...store,
      updatedAt: nowIso()
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
    } catch (error) {
      // Ignore storage limits and private-mode errors.
    }

    return nextStore;
  }

  function addActivity(store, type, message) {
    store.activity.unshift({
      id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      message,
      createdAt: nowIso()
    });
    store.activity = store.activity.slice(0, 100);
  }

  function calculateLeadScore(input) {
    const boardWeights = { CBSE: 8, ICSE: 10, IGCSE: 12, IB: 14 };
    const subjectWeights = {
      Mathematics: 12,
      Science: 10,
      English: 8,
      "Social Studies": 7,
      Hindi: 6,
      Coding: 14
    };

    const grade = clamp(toNumber(input.grade, 1), 1, 12);
    const weeklyHours = clamp(toNumber(input.weeklyHours, 2), 1, 12);
    const startInDays = clamp(toNumber(input.startInDays, 14), 1, 45);

    let score = 24;
    score += boardWeights[input.board] || 6;
    score += subjectWeights[input.subject] || 6;
    score += weeklyHours * 3.1;

    if (grade >= 6) {
      score += 7;
    }

    if (startInDays <= 3) {
      score += 15;
    } else if (startInDays <= 7) {
      score += 10;
    } else if (startInDays <= 14) {
      score += 5;
    } else {
      score += 2;
    }

    const goals = normalizeString(input.goals).toLowerCase();
    const keywords = ["exam", "olympiad", "confidence", "writing", "coding", "foundation"];
    const hits = keywords.reduce((total, keyword) => total + (goals.includes(keyword) ? 1 : 0), 0);
    score += hits * 3;

    return Math.round(clamp(score, 25, 99));
  }

  function derivePriority(score) {
    if (score >= 78) return "high";
    if (score >= 60) return "medium";
    return "nurture";
  }

  function getNextBestAction(score) {
    if (score >= 78) {
      return "Call parent within 30 minutes and lock a trial slot";
    }
    if (score >= 60) {
      return "Share learning blueprint and schedule trial within 24 hours";
    }
    return "Send curriculum sample and re-engage after 48 hours";
  }

  function buildBlueprint(input) {
    const subject = normalizeString(input.subject) || "Core Subject";
    const grade = clamp(toNumber(input.grade, 1), 1, 12);
    const weeklyHours = clamp(toNumber(input.weeklyHours, 2), 1, 12);
    const intensity = weeklyHours >= 5 ? "high" : weeklyHours >= 3 ? "moderate" : "steady";

    const weeklyPlan = [
      `2x ${subject} deep-work sessions`,
      "1x recap + assignment feedback loop",
      "Daily 20-minute revision prompt"
    ];

    if (weeklyHours >= 5) {
      weeklyPlan.push("1x challenge lab for higher-order problem solving");
    }

    return {
      intensity,
      projectedImprovementPercent: clamp(Math.round(weeklyHours * 4.8 + 8), 12, 46),
      phases: [
        {
          title: "Diagnostics + Learning Map",
          timeline: "Week 1",
          focus: `Benchmark ${subject} fundamentals and identify top 3 friction zones.`
        },
        {
          title: "Concept Reconstruction",
          timeline: "Week 2-4",
          focus: `Target grade ${grade} outcomes with adaptive worksheets and tutor walkthroughs.`
        },
        {
          title: "Application Sprints",
          timeline: "Week 5-8",
          focus: "Timed practice, structured doubt-clearing, and parent progress checkpoint."
        }
      ],
      weeklyPlan
    };
  }

  function scoreTutorFit(payload, tutor) {
    const grade = clamp(toNumber(payload.grade, 1), 1, 12);
    const preferredTime = normalizeString(payload.preferredTime);
    let fit = 0;

    if (tutor.subjects.includes(payload.subject)) {
      fit += 34;
    }

    const [minGrade, maxGrade] = tutor.gradeBand;
    if (grade >= minGrade && grade <= maxGrade) {
      fit += 27;
    }

    if (tutor.availability.includes(preferredTime)) {
      fit += 20;
    }

    fit += tutor.experienceYears * 1.5;
    fit += tutor.rating * 4;

    return Math.round(clamp(fit, 20, 99));
  }

  function matchTutor(payload) {
    const ranked = TUTORS.map((tutor) => ({
      tutorId: tutor.id,
      tutorName: tutor.name,
      subjects: tutor.subjects,
      rating: tutor.rating,
      experienceYears: tutor.experienceYears,
      suggestedSlots: tutor.availability,
      fitScore: scoreTutorFit(payload, tutor)
    })).sort((a, b) => b.fitScore - a.fitScore);

    return {
      primary: ranked[0] || null,
      backups: ranked.slice(1, 3)
    };
  }

  function simulateProgress(payload) {
    const baselineScore = clamp(toNumber(payload.baselineScore, 52), 20, 95);
    const weeklyHours = clamp(toNumber(payload.weeklyHours, 3), 1, 12);
    const weeks = clamp(toNumber(payload.weeks, 8), 2, 24);
    const improvementCurve = Math.log1p(weeklyHours) * weeks * 1.45;

    const projectedScore = Math.round(clamp(baselineScore + improvementCurve, baselineScore, 99));
    const projectedGain = projectedScore - baselineScore;
    const confidence = Math.round(
      clamp(52 + weeklyHours * 2.8 + (weeks >= 12 ? 7 : 0) + projectedGain * 0.8, 56, 96)
    );

    return {
      baselineScore,
      projectedScore,
      projectedGain,
      confidence,
      narrative:
        projectedGain >= 14
          ? "High-growth plan with strong session density."
          : "Steady growth path; add one extra focused session for faster outcomes."
    };
  }

  function summarizePipeline(leads) {
    return LEAD_STATUSES.map((status) => ({
      status,
      count: leads.filter((lead) => lead.status === status).length
    }));
  }

  function getOverview(store) {
    const leads = store.leads || [];
    const enrolled = leads.filter((lead) => lead.status === "enrolled").length;
    const averageLeadScore =
      leads.length === 0
        ? 0
        : Math.round(leads.reduce((sum, lead) => sum + (Number(lead.score) || 0), 0) / leads.length);

    return {
      totalLeads: leads.length,
      activeTutors: TUTORS.length,
      conversionRate: leads.length ? Math.round((enrolled / leads.length) * 100) : 0,
      averageLeadScore,
      openApplications: (store.tutorApplications || []).filter((item) => item.status === "received")
        .length,
      responseSlaMinutes: leads.length ? 28 : 0
    };
  }

  function requireFields(payload, fields) {
    return fields.filter((field) => {
      const value = payload[field];
      if (typeof value === "number") {
        return false;
      }
      return !normalizeString(String(value || ""));
    });
  }

  function parseBody(options) {
    const body = options && options.body;
    if (!body) {
      return {};
    }

    if (typeof body === "string") {
      try {
        return JSON.parse(body);
      } catch (error) {
        return {};
      }
    }

    return body;
  }

  function createLeadId(sequenceNumber) {
    const now = new Date();
    const dateToken = now.toISOString().slice(0, 10).replace(/-/g, "");
    return `TH-${dateToken}-${String(sequenceNumber).padStart(4, "0")}`;
  }

  function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const payload = parseBody(options);
    const store = readStore();

    if (path === "/health" && method === "GET") {
      return Promise.resolve({
        status: "ok",
        timestamp: nowIso(),
        service: "TutorHive Browser Runtime"
      });
    }

    if (path === "/programs" && method === "GET") {
      return Promise.resolve({ programs: PROGRAMS });
    }

    if (path === "/sessions/upcoming" && method === "GET") {
      return Promise.resolve({
        sessions: (store.upcomingSessions || []).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      });
    }

    if (path === "/dashboard/overview" && method === "GET") {
      return Promise.resolve({ overview: getOverview(store) });
    }

    if (path === "/dashboard/pipeline" && method === "GET") {
      return Promise.resolve({ pipeline: summarizePipeline(store.leads || []) });
    }

    if (path === "/dashboard/recent-activity" && method === "GET") {
      return Promise.resolve({ recentActivity: (store.activity || []).slice(0, 12) });
    }

    if (path === "/simulate-progress" && method === "POST") {
      return Promise.resolve({ simulation: simulateProgress(payload) });
    }

    if (path === "/leads" && method === "POST") {
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
        return Promise.reject(new Error(`Missing fields: ${missing.join(", ")}`));
      }

      const score = calculateLeadScore(payload);
      const priority = derivePriority(score);
      const tutorMatch = matchTutor(payload);
      const lead = {
        leadId: createLeadId((store.leads || []).length + 1),
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
        blueprint: buildBlueprint(payload),
        nextBestAction: getNextBestAction(score),
        createdAt: nowIso()
      };

      store.leads.unshift(lead);
      addActivity(store, "lead", `${lead.leadId} created for ${lead.studentName}`);
      writeStore(store);

      return Promise.resolve({
        message: "Lead captured and learning blueprint generated.",
        lead,
        backupTutors: tutorMatch.backups
      });
    }

    if (path === "/tutor-applications" && method === "POST") {
      const missing = requireFields(payload, [
        "name",
        "email",
        "subject",
        "experienceYears",
        "availability"
      ]);

      if (missing.length > 0) {
        return Promise.reject(new Error(`Missing fields: ${missing.join(", ")}`));
      }

      const experienceYears = Number(payload.experienceYears) || 0;
      const profileScore = Math.round(
        Math.min(95, 50 + experienceYears * 4 + (normalizeString(payload.message).length > 80 ? 8 : 0))
      );

      const application = {
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
        createdAt: nowIso()
      };

      store.tutorApplications.unshift(application);
      addActivity(store, "tutor", `Tutor application ${application.applicationId} received`);
      writeStore(store);

      return Promise.resolve({
        message: "Tutor application submitted.",
        application
      });
    }

    if (path === "/contact" && method === "POST") {
      const missing = requireFields(payload, ["name", "email", "message"]);
      if (missing.length > 0) {
        return Promise.reject(new Error(`Missing fields: ${missing.join(", ")}`));
      }

      const ticket = {
        ticketId: `CT-${Date.now()}`,
        name: normalizeString(payload.name),
        email: normalizeString(payload.email),
        phone: normalizeString(payload.phone),
        message: normalizeString(payload.message),
        createdAt: nowIso()
      };

      store.contacts.unshift(ticket);
      addActivity(store, "contact", `New contact request from ${ticket.name}`);
      writeStore(store);

      return Promise.resolve({
        message: "Support ticket created.",
        ticket
      });
    }

    if (path === "/admin/leads" && method === "GET") {
      return Promise.resolve({
        leads: (store.leads || []).slice(0, 50),
        pipeline: summarizePipeline(store.leads || [])
      });
    }

    const leadPatchMatch = path.match(/^\/admin\/leads\/([^/]+)$/);
    if (leadPatchMatch && method === "PATCH") {
      const leadId = leadPatchMatch[1];
      const status = normalizeString(payload.status);

      if (!LEAD_STATUSES.includes(status)) {
        return Promise.reject(new Error("Invalid status"));
      }

      const lead = (store.leads || []).find((item) => item.leadId === leadId);
      if (!lead) {
        return Promise.reject(new Error("Lead not found"));
      }

      lead.status = status;
      lead.updatedAt = nowIso();
      addActivity(store, "pipeline", `${lead.leadId} moved to ${status.replace(/_/g, " ")}`);
      writeStore(store);

      return Promise.resolve({
        message: "Lead status updated",
        lead
      });
    }

    return Promise.reject(new Error(`Mock route not found: ${method} ${path}`));
  }

  window.TutorHiveMockApi = {
    request,
    readStore,
    writeStore,
    getStoreKey: function getStoreKey() {
      return STORAGE_KEY;
    }
  };
})();
