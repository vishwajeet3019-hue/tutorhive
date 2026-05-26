const { Pool } = require("pg");

const TEMPLATE_VERSION = 4;

function defaultCourses(subject = "Maths") {
  return [
    {
      id: "course_1",
      title: "Tutoring 1:1 Course",
      description: "Personalized live classes with concept clarity, guided practice, and steady progress tracking.",
      price: "₹3,499/month",
      imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80"
    },
    {
      id: "course_2",
      title: "Exam Preparation",
      description: "Focused revision, test practice, doubt clearing, and exam strategy for confident performance.",
      price: subject.toLowerCase().includes("english") ? "₹3,499/month" : "₹3,499/month",
      imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80"
    },
    {
      id: "course_3",
      title: "Foundation Builder",
      description: "Strengthen basics, improve consistency, and build better study habits through 1:1 support.",
      price: "₹2,999/month",
      imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80"
    }
  ];
}

function normalizeTemplate(template = {}) {
  if (!template || typeof template !== "object") return template;
  const subject = template.service1 || template.subject || "Maths";
  const next = { ...template, templateVersion: TEMPLATE_VERSION };
  const defaultApproachText = "Every student starts with a clear goal, a simple study plan, and regular practice. Parents get honest updates, students get patient support, and classes stay focused on confidence, consistency, and measurable academic progress.";

  next.sectionOrder = (Array.isArray(next.sectionOrder) ? next.sectionOrder : ["courses", "reviews", "contact"])
    .filter(key => key !== "services" && key !== "approach");

  next.customSections = (Array.isArray(next.customSections) ? next.customSections : [])
    .filter(section => {
      if (!section || section.id !== "approach") return true;
      return section.title !== "How learning improves here" || section.text !== defaultApproachText;
    })
    .map(section => ({ showInNav: false, ...section }));

  const customIds = new Set(next.customSections.map(section => section.id));
  next.sectionOrder = next.sectionOrder.filter(key => key === "courses" || key === "reviews" || key === "contact" || customIds.has(key));
  for (const key of ["courses", "reviews", "contact"]) {
    if (!next.sectionOrder.includes(key)) next.sectionOrder.push(key);
  }
  if (!next.sectionOrder.includes("courses")) next.sectionOrder.unshift("courses");
  next.courses = Array.isArray(next.courses) && next.courses.length ? next.courses : defaultCourses(subject);
  next.showExperienceBadge = next.showExperienceBadge || "on";
  next.showPricingBadge = next.showPricingBadge || "on";
  next.inquiryClass = next.inquiryClass || "on";
  next.inquirySubject = next.inquirySubject || "on";
  return next;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL to the Render External Database URL before running this script.");
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT id, draft_template, published_template FROM websites ORDER BY id");
    let changed = 0;
    for (const row of rows) {
      const draftTemplate = normalizeTemplate(row.draft_template);
      const publishedTemplate = row.published_template ? normalizeTemplate(row.published_template) : null;
      await client.query(
        "UPDATE websites SET draft_template = $1, published_template = $2 WHERE id = $3",
        [draftTemplate, publishedTemplate, row.id]
      );
      changed += 1;
    }
    await client.query("COMMIT");
    console.log(`Migrated ${changed} website templates to template version ${TEMPLATE_VERSION}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
