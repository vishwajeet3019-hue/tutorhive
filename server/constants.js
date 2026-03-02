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

const TUTOR_POOL = [
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
  },
  {
    id: "T-153",
    name: "Sahir Khan",
    subjects: ["Coding", "Science"],
    gradeBand: [5, 9],
    experienceYears: 4,
    rating: 4.6,
    availability: ["Weekday Evening", "Weekend Morning"]
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

const LEAD_STATUSES = [
  "new",
  "qualified",
  "trial_scheduled",
  "trial_done",
  "enrolled",
  "paused",
  "lost"
];

module.exports = {
  LEAD_STATUSES,
  PROGRAMS,
  TUTOR_POOL,
  UPCOMING_SESSIONS
};
