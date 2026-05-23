const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8091);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "tutorhive-db.json");
const PUBLIC_FILES = new Set(["/", "/index.html", "/trial-thank-you.html", "/tutorhive-os.html", "/tutorhive-dashboard.html", "/tutorhive-admin.html", "/mobile-fixes.css", "/seo-pages.css", "/logo.png", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/CNAME"]);
const DATABASE_URL = process.env.DATABASE_URL || "";
const SITE_BASE_DOMAIN = process.env.SITE_BASE_DOMAIN || "tutorhive.in";
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || "https://tutorhive.in,https://www.tutorhive.in").split(",").map(value => value.trim()).filter(Boolean));
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const COOKIE_SECURE = process.env.NODE_ENV === "production" ? "; Secure" : "";
let pgPool = null;

const defaultImage = "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1100&q=80";

function initialDb() {
  return { tutors: [], sessions: [], websites: [], enquiries: [], analytics: [], activityLogs: [], feedbacks: [] };
}

async function ensurePostgres() {
  if (!DATABASE_URL) return null;
  if (!pgPool) {
    const { Pool } = require("pg");
    pgPool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } });
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS tutors (
        id text PRIMARY KEY,
        name text,
        email text UNIQUE NOT NULL,
        phone text,
        city text,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token text PRIMARY KEY,
        tutor_id text REFERENCES tutors(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS websites (
        id text PRIMARY KEY,
        tutor_id text REFERENCES tutors(id) ON DELETE CASCADE,
        slug text UNIQUE,
        custom_domain text UNIQUE,
        domain_status text,
        draft_template jsonb NOT NULL,
        published_template jsonb,
        published_at timestamptz,
        last_domain_check_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS enquiries (
        id text PRIMARY KEY,
        website_id text REFERENCES websites(id) ON DELETE CASCADE,
        slug text,
        name text,
        phone text,
        email text,
        message text,
        status text,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS analytics_events (
        id text PRIMARY KEY,
        website_id text REFERENCES websites(id) ON DELETE CASCADE,
        slug text,
        event_type text,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activity_logs (
        id text PRIMARY KEY,
        tutor_id text,
        website_id text,
        type text,
        message text,
        metadata jsonb,
        ip text,
        user_agent text,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedbacks (
        id text PRIMARY KEY,
        tutor_id text REFERENCES tutors(id) ON DELETE SET NULL,
        website_id text REFERENCES websites(id) ON DELETE SET NULL,
        rating integer,
        liked text,
        improve text,
        created_at timestamptz NOT NULL
      );
    `);
    await pgPool.query("ALTER TABLE tutors ADD COLUMN IF NOT EXISTS name text");
    await pgPool.query("ALTER TABLE tutors ADD COLUMN IF NOT EXISTS city text");
  }
  return pgPool;
}

async function readDb() {
  const pool = await ensurePostgres();
  if (pool) {
    const [tutors, sessions, websites, enquiries, analytics, activityLogs, feedbacks] = await Promise.all([
      pool.query("SELECT * FROM tutors"),
      pool.query("SELECT * FROM sessions"),
      pool.query("SELECT * FROM websites"),
      pool.query("SELECT * FROM enquiries ORDER BY created_at ASC"),
      pool.query("SELECT * FROM analytics_events ORDER BY created_at ASC"),
      pool.query("SELECT * FROM activity_logs ORDER BY created_at ASC"),
      pool.query("SELECT * FROM feedbacks ORDER BY created_at ASC")
    ]);
    return {
      tutors: tutors.rows.map(row => ({ id: row.id, name: row.name || "", email: row.email, phone: row.phone || "", city: row.city || "", passwordHash: row.password_hash, createdAt: row.created_at.toISOString() })),
      sessions: sessions.rows.map(row => ({ token: row.token, tutorId: row.tutor_id, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString() })),
      websites: websites.rows.map(row => ({ id: row.id, tutorId: row.tutor_id, slug: row.slug || "", customDomain: row.custom_domain || "", domainStatus: row.domain_status || "not_connected", draftTemplate: row.draft_template, publishedTemplate: row.published_template, publishedAt: row.published_at ? row.published_at.toISOString() : "", lastDomainCheckAt: row.last_domain_check_at ? row.last_domain_check_at.toISOString() : "" })),
      enquiries: enquiries.rows.map(row => ({ id: row.id, websiteId: row.website_id, slug: row.slug || "", name: row.name || "", phone: row.phone || "", email: row.email || "", message: row.message || "", status: row.status || "new", createdAt: row.created_at.toISOString() })),
      analytics: analytics.rows.map(row => ({ id: row.id, websiteId: row.website_id, slug: row.slug || "", eventType: row.event_type || "", createdAt: row.created_at.toISOString() })),
      activityLogs: activityLogs.rows.map(row => ({ id: row.id, tutorId: row.tutor_id || "", websiteId: row.website_id || "", type: row.type || "", message: row.message || "", metadata: row.metadata || {}, ip: row.ip || "", userAgent: row.user_agent || "", createdAt: row.created_at.toISOString() })),
      feedbacks: feedbacks.rows.map(row => ({ id: row.id, tutorId: row.tutor_id || "", websiteId: row.website_id || "", rating: row.rating || 0, liked: row.liked || "", improve: row.improve || "", createdAt: row.created_at.toISOString() }))
    };
  }
  if (!fs.existsSync(DB_FILE)) return initialDb();
  return { ...initialDb(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
}

async function writeDb(db) {
  const pool = await ensurePostgres();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const tutor of db.tutors) {
        await client.query(
          `INSERT INTO tutors (id,name,email,phone,city,password_hash,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, city=EXCLUDED.city, password_hash=EXCLUDED.password_hash`,
          [tutor.id, tutor.name || "", tutor.email, tutor.phone || "", tutor.city || "", tutor.passwordHash, tutor.createdAt]
        );
      }
      await client.query("DELETE FROM sessions");
      for (const session of db.sessions) {
        await client.query("INSERT INTO sessions (token,tutor_id,created_at,expires_at) VALUES ($1,$2,$3,$4)", [session.token, session.tutorId, session.createdAt, session.expiresAt]);
      }
      for (const website of db.websites) {
        await client.query(
          `INSERT INTO websites (id,tutor_id,slug,custom_domain,domain_status,draft_template,published_template,published_at,last_domain_check_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, custom_domain=EXCLUDED.custom_domain, domain_status=EXCLUDED.domain_status, draft_template=EXCLUDED.draft_template, published_template=EXCLUDED.published_template, published_at=EXCLUDED.published_at, last_domain_check_at=EXCLUDED.last_domain_check_at`,
          [website.id, website.tutorId, website.slug || null, website.customDomain || null, website.domainStatus || "not_connected", website.draftTemplate, website.publishedTemplate || null, website.publishedAt || null, website.lastDomainCheckAt || null]
        );
      }
      await client.query("DELETE FROM enquiries");
      for (const enquiry of db.enquiries) {
        await client.query(
          "INSERT INTO enquiries (id,website_id,slug,name,phone,email,message,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [enquiry.id, enquiry.websiteId, enquiry.slug || "", enquiry.name || "", enquiry.phone || "", enquiry.email || "", enquiry.message || "", enquiry.status || "new", enquiry.createdAt]
        );
      }
      await client.query("DELETE FROM analytics_events");
      for (const event of db.analytics || []) {
        await client.query(
          "INSERT INTO analytics_events (id,website_id,slug,event_type,created_at) VALUES ($1,$2,$3,$4,$5)",
          [event.id, event.websiteId, event.slug || "", event.eventType || "", event.createdAt]
        );
      }
      await client.query("DELETE FROM activity_logs");
      for (const log of db.activityLogs || []) {
        await client.query(
          "INSERT INTO activity_logs (id,tutor_id,website_id,type,message,metadata,ip,user_agent,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [log.id, log.tutorId || null, log.websiteId || null, log.type || "", log.message || "", log.metadata || {}, log.ip || "", log.userAgent || "", log.createdAt]
        );
      }
      await client.query("DELETE FROM feedbacks");
      for (const feedback of db.feedbacks || []) {
        await client.query(
          "INSERT INTO feedbacks (id,tutor_id,website_id,rating,liked,improve,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [feedback.id, feedback.tutorId || null, feedback.websiteId || null, Number(feedback.rating || 0), feedback.liked || "", feedback.improve || "", feedback.createdAt]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function slugify(value) {
  return String(value || "my-tutor-site").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-tutor-site";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt] = String(stored || "").split(":");
  return hashPassword(password, salt) === stored;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").filter(Boolean).map(item => {
    const [key, ...value] = item.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {"Content-Type": typeof body === "string" ? "text/html; charset=utf-8" : "application/json", ...headers});
  res.end(payload);
}

function sendJson(res, status, body, headers = {}) {
  send(res, status, body, {"Content-Type": "application/json", ...headers});
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Vary": "Origin"
  };
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function bodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
  });
}

function currentTutor(req, db) {
  const token = parseCookies(req).th_session;
  if (!token) return null;
  const session = db.sessions.find(item => item.token === token && new Date(item.expiresAt) > new Date());
  if (!session) return null;
  return db.tutors.find(tutor => tutor.id === session.tutorId) || null;
}

function requireTutor(req, res, db) {
  const tutor = currentTutor(req, db);
  if (!tutor) {
    sendJson(res, 401, { error: "Login required" });
    return null;
  }
  return tutor;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}

function requireAdmin(req, res) {
  const provided = req.headers["x-admin-token"] || new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("token") || parseCookies(req).th_admin;
  const isLocal = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(clientIp(req));
  if ((ADMIN_TOKEN && provided === ADMIN_TOKEN) || (!ADMIN_TOKEN && isLocal)) return true;
  sendJson(res, 401, { error: ADMIN_TOKEN ? "Admin token required" : "Set ADMIN_TOKEN in production to enable admin access" });
  return false;
}

function publicTutor(tutor) {
  return { id: tutor.id, name: tutor.name || "", email: tutor.email || "", phone: tutor.phone || "", city: tutor.city || "", createdAt: tutor.createdAt || "" };
}

function publicSession(session) {
  return { tutorId: session.tutorId, createdAt: session.createdAt, expiresAt: session.expiresAt, active: new Date(session.expiresAt) > new Date() };
}

function recordActivity(db, req, { tutor, website, type, message, metadata = {} }) {
  db.activityLogs = db.activityLogs || [];
  db.activityLogs.push({
    id: id("act"),
    tutorId: tutor?.id || website?.tutorId || "",
    websiteId: website?.id || "",
    type,
    message,
    metadata,
    ip: clientIp(req),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    createdAt: new Date().toISOString()
  });
}

function adminOverview(db) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const activeSessions = db.sessions.filter(session => new Date(session.expiresAt) > now);
  const tutorById = new Map(db.tutors.map(tutor => [tutor.id, publicTutor(tutor)]));
  const websiteById = new Map(db.websites.map(website => [website.id, website]));
  const websiteByTutorId = new Map(db.websites.map(website => [website.tutorId, website]));
  const analytics = db.analytics || [];
  const activityLogs = db.activityLogs || [];
  const hasActivity = (type, matcher) => activityLogs.some(log => log.type === type && matcher(log));
  const legacyActivity = [
    ...db.tutors
      .filter(tutor => !hasActivity("signup", log => log.tutorId === tutor.id))
      .map(tutor => {
        const website = websiteByTutorId.get(tutor.id);
        return {
          id: `legacy_signup_${tutor.id}`,
          type: "signup",
          message: `${tutor.name || tutor.email} created a TutorHive OS account`,
          createdAt: tutor.createdAt,
          source: "legacy",
          tutor: tutorById.get(tutor.id) || null,
          website: website ? publicWebsite(website) : null,
          metadata: { email: tutor.email || "", city: tutor.city || "" }
        };
      }),
    ...db.sessions
      .filter(session => !hasActivity("login", log => log.tutorId === session.tutorId && Math.abs(new Date(log.createdAt) - new Date(session.createdAt)) < 60000))
      .map(session => {
        const tutor = tutorById.get(session.tutorId);
        const website = websiteByTutorId.get(session.tutorId);
        return {
          id: `legacy_session_${session.token}`,
          type: "session",
          message: `${tutor?.name || tutor?.email || "Tutor"} session started`,
          createdAt: session.createdAt,
          source: "legacy",
          tutor: tutor || null,
          website: website ? publicWebsite(website) : null,
          metadata: { expiresAt: session.expiresAt, active: new Date(session.expiresAt) > now }
        };
      }),
    ...db.websites
      .filter(website => website.publishedAt && !hasActivity("publish", log => log.websiteId === website.id))
      .map(website => {
        const tutor = tutorById.get(website.tutorId);
        return {
          id: `legacy_publish_${website.id}`,
          type: "publish",
          message: `${tutor?.name || tutor?.email || "Tutor"} published ${website.slug || "a website"}`,
          createdAt: website.publishedAt,
          source: "legacy",
          tutor: tutor || null,
          website: publicWebsite(website),
          metadata: { slug: website.slug || "" }
        };
      }),
    ...db.enquiries
      .filter(enquiry => !hasActivity("enquiry_received", log => log.metadata?.email === enquiry.email && log.metadata?.phone === enquiry.phone && log.websiteId === enquiry.websiteId))
      .map(enquiry => {
        const website = websiteById.get(enquiry.websiteId);
        return {
          id: `legacy_enquiry_${enquiry.id}`,
          type: "enquiry_received",
          message: `New enquiry on ${enquiry.slug || "published site"}`,
          createdAt: enquiry.createdAt,
          source: "legacy",
          tutor: website ? tutorById.get(website.tutorId) || null : null,
          website: website ? publicWebsite(website) : null,
          metadata: { name: enquiry.name || "", phone: enquiry.phone || "", email: enquiry.email || "" }
        };
      })
  ];
  const recentActivity = [
    ...activityLogs.map(log => ({ ...log, source: "os", tutor: tutorById.get(log.tutorId) || null, website: websiteById.get(log.websiteId) ? publicWebsite(websiteById.get(log.websiteId)) : null })),
    ...legacyActivity,
    ...analytics.slice(-300).map(event => {
      const website = websiteById.get(event.websiteId);
      return {
        id: event.id,
        type: event.eventType,
        message: event.eventType === "visit" ? `Website visit on ${event.slug || "published site"}` : `Website ${event.eventType.replace(/_/g, " ")}`,
        createdAt: event.createdAt,
        source: "site",
        tutor: website ? tutorById.get(website.tutorId) || null : null,
        website: website ? publicWebsite(website) : null,
        metadata: { slug: event.slug || "" }
      };
    })
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 120);
  return {
    generatedAt: now.toISOString(),
    totals: {
      tutors: db.tutors.length,
      activeSessions: activeSessions.length,
      websites: db.websites.length,
      publishedWebsites: db.websites.filter(website => website.publishedTemplate).length,
      visits: analytics.filter(event => event.eventType === "visit").length,
      enquiries: db.enquiries.length,
      whatsappClicks: analytics.filter(event => event.eventType === "whatsapp_click").length,
      feedbacks: (db.feedbacks || []).length,
      activity24h: recentActivity.filter(item => new Date(item.createdAt) >= dayAgo).length
    },
    tutors: db.tutors.map(tutor => {
      const website = db.websites.find(item => item.tutorId === tutor.id);
      const sessions = db.sessions.filter(session => session.tutorId === tutor.id);
      const websiteEvents = website ? analytics.filter(event => event.websiteId === website.id) : [];
      return {
        ...publicTutor(tutor),
        active: sessions.some(session => new Date(session.expiresAt) > now),
        lastSeenAt: sessions.concat(activityLogs.filter(log => log.tutorId === tutor.id)).map(item => item.createdAt).sort().pop() || tutor.createdAt,
        website: website ? publicWebsite(website) : null,
        visits: websiteEvents.filter(event => event.eventType === "visit").length,
        enquiries: website ? db.enquiries.filter(item => item.websiteId === website.id).length : 0,
        whatsappClicks: websiteEvents.filter(event => event.eventType === "whatsapp_click").length
      };
    }).sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0)),
    enquiries: db.enquiries.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 60).map(enquiry => {
      const website = websiteById.get(enquiry.websiteId);
      const tutor = website ? tutorById.get(website.tutorId) || null : null;
      return { ...enquiry, tutor, website: website ? publicWebsite(website) : null };
    }),
    feedbacks: (db.feedbacks || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 60).map(feedback => {
      const tutor = tutorById.get(feedback.tutorId) || null;
      const website = websiteById.get(feedback.websiteId);
      return { ...feedback, tutor, website: website ? publicWebsite(website) : null };
    }),
    activity: recentActivity
  };
}

function templateFromSignup(data) {
  return {
    tutorName: data.name || "",
    instituteName: "",
    kicker: `${data.location || "Your city"} ${data.subject || "subject"} tutor`,
    headline: `${data.subject || "Tutoring"} support that feels personal, clear, and confidence-building.`,
    subhead: "Grades 6-10 · Online and home tuition",
    experience: "7 years experience",
    pricing: "₹700/class",
    showExperienceBadge: "on",
    showPricingBadge: "on",
    experienceX: "18",
    experienceY: "18",
    pricingX: "24",
    pricingY: "24",
    service1: data.subject || "Maths",
    service2: "Concept clarity",
    service3: "Exam prep",
    testimonial: "\"The classes are structured, clear, and helped my child gain confidence.\"",
    ctaButton: "Book Demo",
    inquiryTitle: "Send an inquiry",
    inquiryName: "on",
    inquiryPhone: "on",
    inquiryEmail: "on",
    inquiryMessage: "on",
    customDomain: "",
    siteSlug: "",
    whatsapp: data.phone || "",
    idealStudent: "",
    publishedAt: "",
    imageUrl: defaultImage,
    logoUrl: "",
    pageBg: "#ffffff",
    sectionBg: "#f4fdfc",
    spacing: "34",
    sectionOrder: ["services", "reviews", "contact"],
    serviceOrder: ["service1", "service2", "service3"],
    reviews: [{ text: "\"The classes are structured, clear, and helped my child gain confidence.\"", stars: 5 }],
    customSections: []
  };
}

function publicWebsite(website) {
  return {
    id: website.id,
    tutorId: website.tutorId,
    slug: website.slug,
    customDomain: website.customDomain || "",
    domainStatus: website.domainStatus || "not_connected",
    draftTemplate: website.draftTemplate,
    publishedTemplate: website.publishedTemplate,
    publishedAt: website.publishedAt || ""
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}

function stars(count) {
  return "★★★★★".slice(0, Number(count || 5));
}

function cleanHost(host) {
  return String(host || "").toLowerCase().split(":")[0];
}

function subdomainSlug(host) {
  const clean = cleanHost(host);
  const suffix = `.${SITE_BASE_DOMAIN}`;
  if (!clean.endsWith(suffix)) return "";
  const label = clean.slice(0, -suffix.length);
  if (!label || label === "www" || label.includes(".")) return "";
  return label;
}

function publicSiteUrl(slug) {
  return `https://${slugify(slug)}.${SITE_BASE_DOMAIN}`;
}

function recordAnalytics(db, website, eventType) {
  db.analytics = db.analytics || [];
  db.analytics.push({ id: id("evt"), websiteId: website.id, slug: website.slug, eventType, createdAt: new Date().toISOString() });
}

function analyticsSummary(db, website) {
  const events = (db.analytics || []).filter(item => item.websiteId === website.id);
  return {
    visits: events.filter(item => item.eventType === "visit").length,
    enquiries: db.enquiries.filter(item => item.websiteId === website.id).length,
    whatsappClicks: events.filter(item => item.eventType === "whatsapp_click").length
  };
}

function renderSite(website) {
  const t = website.publishedTemplate;
  if (!t) return null;
  const sections = (t.sectionOrder || ["services", "reviews", "contact"]).map(key => {
    if (key === "services") {
      return `<section class="band tint" id="programs"><strong>Programs</strong><div class="columns">${(t.serviceOrder || ["service1","service2","service3"]).map(service => `<div class="mini"><strong>${escapeHtml(t[service])}</strong><p>${escapeHtml({service1:"Focused concept clarity",service2:"Practice and feedback",service3:"Exam-ready revision"}[service])}</p></div>`).join("")}</div></section>`;
    }
    if (key === "reviews") {
      return `<section class="band" id="reviews"><strong>What students say</strong><div class="reviews-grid">${(t.reviews || []).map(review => `<div class="review-card"><div class="stars">${stars(review.stars)}</div><p>${escapeHtml(review.text)}</p>${review.author ? `<strong>- ${escapeHtml(review.author)}</strong>` : ""}</div>`).join("")}</div></section>`;
    }
    if (key === "contact") {
      return `<section class="band contact" id="contact"><div><strong>Ready for a demo class?</strong><p>Send an inquiry and get timing options on WhatsApp.</p></div><button class="btn teal" id="openInquiry">Send Inquiry</button></section>`;
    }
    const custom = (t.customSections || []).find(section => section.id === key);
    if (!custom) return "";
    return `<section class="band" id="${escapeHtml(custom.id)}"><strong>${escapeHtml(custom.title)}</strong><p>${escapeHtml(custom.text)}</p></section>`;
  }).join("");
  const nav = (t.sectionOrder || []).map(key => {
    const custom = (t.customSections || []).find(section => section.id === key);
    if (custom && !custom.showInNav) return "";
    const label = key === "services" ? "Programs" : key === "reviews" ? "Results" : key === "contact" ? "Contact" : custom?.title || "Page";
    const href = key === "services" ? "#programs" : `#${key}`;
    return `<a href="${href}">${escapeHtml(label)}</a>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(t.instituteName)} | TutorHive OS</title><meta name="description" content="${escapeHtml(t.headline)}"><style>
  *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#0f172a;background:${escapeHtml(t.pageBg || "#fff")}}a{text-decoration:none;color:inherit}.site-nav{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 max(24px,calc((100vw - 1180px)/2));border-bottom:1px solid #e5e7eb;background:#fff}.brand{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:1000;min-width:0}.brand span{overflow-wrap:anywhere}.brand img{width:42px;height:42px;border-radius:10px;object-fit:cover}.links{display:flex;gap:22px;color:#475569;font-weight:900}.pill,.btn{border:0;border-radius:999px;background:#0f172a;color:#fff;font-weight:900;padding:12px 18px;cursor:pointer}.teal{background:linear-gradient(120deg,#0ea5a3,#22d3ee)}.hero{display:grid;grid-template-columns:1.03fr .97fr;gap:34px;align-items:center;padding:54px max(24px,calc((100vw - 1180px)/2));background:linear-gradient(135deg,${escapeHtml(t.sectionBg || "#f4fdfc")} 0%,#fff 55%,#fff7dc 100%)}.kicker{font-size:13px;font-weight:1000;text-transform:uppercase;letter-spacing:.07em;color:#0ea5a3}.title{font-size:clamp(38px,5.2vw,64px);line-height:1.03;margin:12px 0}.lead{font-size:18px;line-height:1.7;color:#475569;max-width:560px}.photo{position:relative;height:380px;border-radius:30px;overflow:hidden;box-shadow:0 24px 60px rgba(2,8,23,.16)}.photo img{width:100%;height:100%;object-fit:cover;display:block}.float{position:absolute;border:1px solid #e5e7eb;border-radius:18px;background:#fff;box-shadow:0 14px 32px rgba(2,8,23,.14);padding:14px;font-weight:900}.left{left:${Number(t.experienceX || 18)}px;top:${Number(t.experienceY || 18)}px}.right{right:${Number(t.pricingX || 24)}px;bottom:${Number(t.pricingY || 24)}px}.band{padding:${Number(t.spacing || 34)}px max(24px,calc((100vw - 1180px)/2));border-top:1px solid #e5e7eb}.tint{background:linear-gradient(135deg,#f8fbff,#f4fdfc)}.columns,.reviews-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.mini,.review-card{border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fff}.review-card p{white-space:pre-line}.stars{color:#f6b51e}.contact{display:flex;align-items:center;justify-content:space-between;gap:18px;background:#0f172a;color:#fff}.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.54);padding:18px}.modal.active{display:flex}.card{width:min(520px,100%);background:#fff;color:#0f172a;border-radius:18px;padding:22px}.form{display:grid;gap:12px}.input{width:100%;border:1px solid #e5e7eb;border-radius:14px;padding:14px;font-size:16px}@media(max-width:900px){.site-nav{align-items:flex-start;flex-direction:column;padding:18px 20px}.hero,.columns,.reviews-grid{grid-template-columns:1fr}.links{flex-wrap:wrap;gap:12px}.pill{display:none}.float{display:none}.hero,.band{padding:28px 20px}.photo{height:260px;border-radius:22px}.contact{display:grid}.btn{width:100%}.title{font-size:clamp(34px,11vw,48px)}}@media(max-width:560px){.site-nav{gap:12px}.brand{font-size:22px}.links{font-size:15px}.hero{gap:24px}.lead{font-size:16px}.photo{height:230px}.band{padding:24px 16px}.hero{padding:28px 16px}.title{font-size:38px}}
  </style></head><body><nav class="site-nav"><strong class="brand">${t.logoUrl ? `<img src="${escapeHtml(t.logoUrl)}" alt="">` : ""}<span>${escapeHtml(t.instituteName)}</span></strong><div class="links">${nav}</div><a class="pill" href="#contact">Get started</a></nav><main><section class="hero"><div><div class="kicker">${escapeHtml(t.kicker)}</div><h1 class="title">${escapeHtml(t.headline)}</h1><p class="lead">By ${escapeHtml(t.tutorName || "Tutor")} · ${escapeHtml(t.subhead)}</p><button class="btn" id="heroInquiry">${escapeHtml(t.ctaButton || "Book Demo")}</button></div><div class="photo"><img src="${escapeHtml(t.imageUrl || defaultImage)}" alt="Tutor website image">${t.showExperienceBadge === "on" ? `<div class="float left">${escapeHtml(t.experience)}<br><span>Structured learning</span></div>` : ""}${t.showPricingBadge === "on" ? `<div class="float right">${escapeHtml(t.pricing)}<br><span>Demo available</span></div>` : ""}</div></section>${sections}</main><div class="modal" id="modal"><div class="card"><h2>${escapeHtml(t.inquiryTitle || "Send an inquiry")}</h2><form class="form" id="inquiryForm">${t.inquiryName === "on" ? '<input class="input" name="name" placeholder="Name" required>' : ""}${t.inquiryPhone === "on" ? '<input class="input" name="phone" placeholder="Phone / WhatsApp" required>' : ""}${t.inquiryEmail === "on" ? '<input class="input" name="email" type="email" placeholder="Email">' : ""}${t.inquiryMessage === "on" ? '<textarea class="input" name="message" rows="4" placeholder="What help do you need?"></textarea>' : ""}<button class="btn teal" type="submit">Submit Inquiry</button><button class="btn" type="button" id="closeModal">Close</button><p id="thanks" style="display:none;color:green;font-weight:900">Inquiry sent.</p></form></div></div><script>
  const modal=document.getElementById("modal");const track=type=>fetch("/api/site/${escapeHtml(website.slug)}/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type})}).catch(()=>{});document.getElementById("openInquiry")?.addEventListener("click",()=>modal.classList.add("active"));document.getElementById("heroInquiry")?.addEventListener("click",()=>modal.classList.add("active"));document.getElementById("closeModal").addEventListener("click",()=>modal.classList.remove("active"));document.getElementById("inquiryForm").addEventListener("submit",async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());await fetch("/api/site/${escapeHtml(website.slug)}/enquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});document.getElementById("thanks").style.display="block";e.currentTarget.reset()});document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"]').forEach(link=>link.addEventListener("click",()=>track("whatsapp_click")));
  </script></body></html>`;
}

function serveFile(req, res, url) {
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const cleanPath = pathname.replace(/^\/+/, "");
  const nestedIndex = path.join(ROOT, cleanPath, "index.html");
  if (!PUBLIC_FILES.has(url.pathname) && !PUBLIC_FILES.has(pathname)) {
    if (!fs.existsSync(nestedIndex)) return false;
    pathname = path.join(pathname, "index.html");
  }
  const file = path.join(ROOT, pathname);
  if (!fs.existsSync(file)) return false;
  const type = pathname.endsWith(".css") ? "text/css" : pathname.endsWith(".png") ? "image/png" : pathname.endsWith(".ico") ? "image/x-icon" : "text/html; charset=utf-8";
  res.writeHead(200, {"Content-Type": type});
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {}, corsHeaders(req));
  const db = await readDb();
  if (req.method === "GET" && url.pathname === "/api/admin/overview") {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, adminOverview(db), corsHeaders(req));
  }
  if (req.method === "POST" && url.pathname === "/api/signup") {
    const data = await bodyJson(req);
    const email = String(data.email || "").trim().toLowerCase();
    if (!email || !data.password) return sendJson(res, 400, { error: "Email and password required" });
    let tutor = db.tutors.find(item => item.email === email);
    if (tutor) return sendJson(res, 409, { error: "Account already exists. Please log in." });
    tutor = { id: id("tutor"), name: data.name || "", email, phone: data.phone || "", city: data.location || "", passwordHash: hashPassword(data.password), createdAt: new Date().toISOString() };
    const website = { id: id("site"), tutorId: tutor.id, slug: "", customDomain: "", domainStatus: "not_connected", draftTemplate: templateFromSignup(data), publishedTemplate: null, publishedAt: "" };
    db.tutors.push(tutor);
    db.websites.push(website);
    const token = id("sess");
    db.sessions.push({ token, tutorId: tutor.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
    recordActivity(db, req, { tutor, website, type: "signup", message: `${tutor.name || tutor.email} created a TutorHive OS account`, metadata: { email: tutor.email, city: tutor.city } });
    await writeDb(db);
    return sendJson(res, 201, { tutor: { id: tutor.id, name: tutor.name, email: tutor.email, city: tutor.city }, website: publicWebsite(website) }, {...corsHeaders(req), "Set-Cookie": `th_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURE}; Max-Age=2592000`});
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    const data = await bodyJson(req);
    const tutor = db.tutors.find(item => item.email === String(data.email || "").trim().toLowerCase());
    if (!tutor || !verifyPassword(data.password, tutor.passwordHash)) return sendJson(res, 401, { error: "Invalid email or password" });
    const token = id("sess");
    db.sessions.push({ token, tutorId: tutor.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
    const website = db.websites.find(item => item.tutorId === tutor.id);
    recordActivity(db, req, { tutor, website, type: "login", message: `${tutor.name || tutor.email} logged in`, metadata: { email: tutor.email } });
    await writeDb(db);
    return sendJson(res, 200, { tutor: { id: tutor.id, name: tutor.name || "", email: tutor.email, city: tutor.city || "" } }, {...corsHeaders(req), "Set-Cookie": `th_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURE}; Max-Age=2592000`});
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = parseCookies(req).th_session;
    const session = db.sessions.find(item => item.token === token);
    const tutor = session ? db.tutors.find(item => item.id === session.tutorId) : null;
    const website = tutor ? db.websites.find(item => item.tutorId === tutor.id) : null;
    const next = { ...db, sessions: db.sessions.filter(session => session.token !== token) };
    if (tutor) recordActivity(next, req, { tutor, website, type: "logout", message: `${tutor.name || tutor.email} logged out`, metadata: { email: tutor.email } });
    await writeDb(next);
    return sendJson(res, 200, { ok: true }, {...corsHeaders(req), "Set-Cookie": `th_session=; HttpOnly; Path=/; SameSite=Lax${COOKIE_SECURE}; Max-Age=0`});
  }
  if (req.method === "GET" && url.pathname === "/api/me") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    return sendJson(res, 200, { tutor: { id: tutor.id, name: tutor.name || "", email: tutor.email, phone: tutor.phone, city: tutor.city || "" }, website: publicWebsite(website) });
  }
  if (url.pathname === "/api/website") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    if (req.method === "GET") return sendJson(res, 200, { website: publicWebsite(website) });
    if (req.method === "PATCH") {
      const data = await bodyJson(req);
      website.draftTemplate = { ...website.draftTemplate, ...(data.draftTemplate || {}) };
      website.slug = slugify(data.slug || website.draftTemplate.siteSlug || website.draftTemplate.instituteName || website.slug);
      website.customDomain = data.customDomain ?? website.draftTemplate.customDomain ?? website.customDomain;
      website.domainStatus = website.customDomain ? "pending_dns" : "not_connected";
      website.draftTemplate.siteSlug = website.slug;
      website.draftTemplate.customDomain = website.customDomain;
      recordActivity(db, req, { tutor, website, type: "website_update", message: `${tutor.name || tutor.email} updated website draft`, metadata: { slug: website.slug, customDomain: website.customDomain || "" } });
      await writeDb(db);
      return sendJson(res, 200, { website: publicWebsite(website) });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/publish") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    website.slug = slugify(website.draftTemplate.siteSlug || website.draftTemplate.instituteName || website.slug);
    website.draftTemplate.siteSlug = website.slug;
    website.publishedTemplate = { ...website.draftTemplate, publishedAt: new Date().toISOString() };
    website.publishedAt = website.publishedTemplate.publishedAt;
    recordActivity(db, req, { tutor, website, type: "publish", message: `${tutor.name || tutor.email} published ${website.slug}.${SITE_BASE_DOMAIN}`, metadata: { slug: website.slug, publicUrl: publicSiteUrl(website.slug) } });
    await writeDb(db);
    return sendJson(res, 200, { website: publicWebsite(website), publicUrl: publicSiteUrl(website.slug) });
  }
  if (req.method === "POST" && url.pathname === "/api/domain/verify") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    if (!website.customDomain) return sendJson(res, 400, { error: "Save a custom domain first" });
    website.domainStatus = "pending_dns";
    website.lastDomainCheckAt = new Date().toISOString();
    recordActivity(db, req, { tutor, website, type: "domain_verify", message: `${tutor.name || tutor.email} requested domain verification`, metadata: { customDomain: website.customDomain } });
    await writeDb(db);
    return sendJson(res, 200, { website: publicWebsite(website), message: "DNS verification queued. Production will check CNAME/TXT records here." });
  }
  if (req.method === "GET" && url.pathname === "/api/enquiries") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    return sendJson(res, 200, { enquiries: db.enquiries.filter(item => item.websiteId === website.id) });
  }
  const enquiryStatusMatch = url.pathname.match(/^\/api\/enquiries\/([^/]+)$/);
  if (req.method === "PATCH" && enquiryStatusMatch) {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    const enquiry = db.enquiries.find(item => item.id === enquiryStatusMatch[1] && item.websiteId === website.id);
    if (!enquiry) return sendJson(res, 404, { error: "Enquiry not found" });
    const data = await bodyJson(req);
    const allowed = new Set(["new", "contacted", "demo_scheduled", "converted"]);
    if (!allowed.has(data.status)) return sendJson(res, 400, { error: "Invalid enquiry status" });
    enquiry.status = data.status;
    recordActivity(db, req, { tutor, website, type: "enquiry_status", message: `${tutor.name || tutor.email} marked an enquiry as ${data.status.replace(/_/g, " ")}`, metadata: { enquiryId: enquiry.id, status: data.status } });
    await writeDb(db);
    return sendJson(res, 200, { enquiry });
  }
  if (req.method === "DELETE" && url.pathname === "/api/enquiries") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    const deletedCount = db.enquiries.filter(item => item.websiteId === website.id).length;
    db.enquiries = db.enquiries.filter(item => item.websiteId !== website.id);
    recordActivity(db, req, { tutor, website, type: "enquiries_deleted", message: `${tutor.name || tutor.email} cleared enquiries`, metadata: { deletedCount } });
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname === "/api/analytics") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    return sendJson(res, 200, { analytics: analyticsSummary(db, website) });
  }
  if (req.method === "POST" && url.pathname === "/api/feedback") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    const data = await bodyJson(req);
    const rating = Math.max(1, Math.min(5, Number(data.rating || 0)));
    if (!rating) return sendJson(res, 400, { error: "Rating required" });
    const feedback = {
      id: id("fb"),
      tutorId: tutor.id,
      websiteId: website?.id || "",
      rating,
      liked: String(data.liked || "").trim().slice(0, 2000),
      improve: String(data.improve || "").trim().slice(0, 2000),
      createdAt: new Date().toISOString()
    };
    db.feedbacks = db.feedbacks || [];
    db.feedbacks.push(feedback);
    recordActivity(db, req, { tutor, website, type: "feedback", message: `${tutor.name || tutor.email} submitted TutorHive OS feedback`, metadata: { rating: feedback.rating } });
    await writeDb(db);
    return sendJson(res, 201, { feedback });
  }
  const enquiryMatch = url.pathname.match(/^\/api\/site\/([^/]+)\/enquiries$/);
  if (req.method === "POST" && enquiryMatch) {
    const slug = enquiryMatch[1];
    const website = db.websites.find(item => item.slug === slug || cleanHost(item.customDomain) === cleanHost(req.headers.host));
    if (!website || !website.publishedTemplate) return sendJson(res, 404, { error: "Published website not found" });
    const data = await bodyJson(req);
    const enquiry = { id: id("enq"), websiteId: website.id, slug: website.slug, name: data.name || "", phone: data.phone || "", email: data.email || "", message: data.message || "", createdAt: new Date().toISOString(), status: "new" };
    db.enquiries.push(enquiry);
    recordAnalytics(db, website, "enquiry");
    recordActivity(db, req, { website, type: "enquiry_received", message: `New enquiry on ${website.slug || "published site"}`, metadata: { name: enquiry.name, phone: enquiry.phone, email: enquiry.email } });
    await writeDb(db);
    return sendJson(res, 201, { enquiry });
  }
  const trackMatch = url.pathname.match(/^\/api\/site\/([^/]+)\/track$/);
  if (req.method === "POST" && trackMatch) {
    const slug = trackMatch[1];
    const website = db.websites.find(item => item.slug === slug || cleanHost(item.customDomain) === cleanHost(req.headers.host));
    if (!website || !website.publishedTemplate) return sendJson(res, 404, { error: "Published website not found" });
    const data = await bodyJson(req);
    const allowed = new Set(["visit", "whatsapp_click"]);
    if (!allowed.has(data.type)) return sendJson(res, 400, { error: "Invalid analytics event" });
    recordAnalytics(db, website, data.type);
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }
  notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    Object.entries(corsHeaders(req)).forEach(([key, value]) => res.setHeader(key, value));
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
    const hostSlug = subdomainSlug(req.headers.host);
    if (hostSlug && url.pathname === "/") {
      const db = await readDb();
      const website = db.websites.find(item => item.slug === hostSlug && item.publishedTemplate);
      const html = website && renderSite(website);
      if (!html) return send(res, 404, "<h1>Website not published yet</h1>");
      recordAnalytics(db, website, "visit");
      await writeDb(db);
      return send(res, 200, html);
    }
    const siteMatch = url.pathname.match(/^\/site\/([^/]+)$/);
    if (siteMatch) {
      const db = await readDb();
      const website = db.websites.find(item => item.slug === siteMatch[1]);
      const html = website && renderSite(website);
      if (!html) return send(res, 404, "<h1>Website not published yet</h1>");
      recordAnalytics(db, website, "visit");
      await writeDb(db);
      return send(res, 200, html);
    }
    const db = await readDb();
    const domainWebsite = db.websites.find(item => item.customDomain && cleanHost(item.customDomain) === cleanHost(req.headers.host) && item.publishedTemplate);
    if (domainWebsite && url.pathname === "/") {
      recordAnalytics(db, domainWebsite, "visit");
      await writeDb(db);
      return send(res, 200, renderSite(domainWebsite));
    }
    if (serveFile(req, res, url)) return;
    notFound(res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`TutorHive OS server running on ${HOST}:${PORT}`);
});
