function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function calculateLeadScore(input) {
  const boardWeights = {
    CBSE: 8,
    ICSE: 10,
    IGCSE: 12,
    IB: 14
  };

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
  const goalSignals = ["exam", "olympiad", "confidence", "writing", "coding", "foundation"];
  const signalHits = goalSignals.reduce(
    (total, keyword) => total + (goals.includes(keyword) ? 1 : 0),
    0
  );

  score += signalHits * 3;
  return Math.round(clamp(score, 25, 99));
}

function derivePriority(score) {
  if (score >= 78) {
    return "high";
  }
  if (score >= 60) {
    return "medium";
  }
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

  const baselineIntensity = weeklyHours >= 5 ? "high" : weeklyHours >= 3 ? "moderate" : "steady";

  const phases = [
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
  ];

  const weeklyPlan = [
    `2x ${subject} deep-work sessions`,
    "1x recap + assignment feedback loop",
    "Daily 20-minute revision prompt"
  ];

  if (weeklyHours >= 5) {
    weeklyPlan.push("1x challenge lab for higher-order problem solving");
  }

  return {
    intensity: baselineIntensity,
    projectedImprovementPercent: clamp(Math.round(weeklyHours * 4.8 + 8), 12, 46),
    phases,
    weeklyPlan
  };
}

function scoreTutorFit(input, tutor) {
  const grade = clamp(toNumber(input.grade, 1), 1, 12);
  const preferredTime = normalizeString(input.preferredTime);

  let fit = 0;
  if (tutor.subjects.includes(input.subject)) {
    fit += 34;
  }

  const [minGrade, maxGrade] = tutor.gradeBand;
  if (grade >= minGrade && grade <= maxGrade) {
    fit += 27;
  } else {
    const distance = grade < minGrade ? minGrade - grade : grade - maxGrade;
    fit += Math.max(0, 18 - distance * 5);
  }

  if (tutor.availability.includes(preferredTime)) {
    fit += 20;
  } else if (
    (preferredTime.includes("Weekday") &&
      tutor.availability.some((slot) => slot.includes("Weekday"))) ||
    (preferredTime.includes("Weekend") &&
      tutor.availability.some((slot) => slot.includes("Weekend")))
  ) {
    fit += 11;
  } else {
    fit += 4;
  }

  fit += tutor.experienceYears * 1.5;
  fit += tutor.rating * 4;

  return Math.round(clamp(fit, 20, 99));
}

function matchTutor(input, tutorPool) {
  const ranked = tutorPool
    .map((tutor) => ({
      tutorId: tutor.id,
      tutorName: tutor.name,
      subjects: tutor.subjects,
      rating: tutor.rating,
      experienceYears: tutor.experienceYears,
      suggestedSlots: tutor.availability,
      fitScore: scoreTutorFit(input, tutor)
    }))
    .sort((a, b) => b.fitScore - a.fitScore);

  return {
    primary: ranked[0] || null,
    backups: ranked.slice(1, 3)
  };
}

function simulateProgress(input) {
  const baselineScore = clamp(toNumber(input.baselineScore, 52), 20, 95);
  const weeklyHours = clamp(toNumber(input.weeklyHours, 3), 1, 12);
  const weeks = clamp(toNumber(input.weeks, 8), 2, 24);

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

module.exports = {
  buildBlueprint,
  calculateLeadScore,
  derivePriority,
  getNextBestAction,
  matchTutor,
  normalizeString,
  simulateProgress
};
