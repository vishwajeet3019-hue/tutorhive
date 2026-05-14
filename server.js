const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8091);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "tutorhive-db.json");
const PUBLIC_FILES = new Set(["/", "/index.html", "/tutorhive-os.html", "/tutorhive-dashboard.html", "/mobile-fixes.css", "/logo.png", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/CNAME"]);
const DATABASE_URL = process.env.DATABASE_URL || "";
const SITE_BASE_DOMAIN = process.env.SITE_BASE_DOMAIN || "tutorhive.in";
let pgPool = null;

const defaultImage = "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1100&q=80";

function initialDb() {
  return { tutors: [], sessions: [], websites: [], enquiries: [] };
}

async function ensurePostgres() {
  if (!DATABASE_URL) return null;
  if (!pgPool) {
    const { Pool } = require("pg");
    pgPool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } });
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS tutors (
        id text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        phone text,
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
    `);
  }
  return pgPool;
}

async function readDb() {
  const pool = await ensurePostgres();
  if (pool) {
    const [tutors, sessions, websites, enquiries] = await Promise.all([
      pool.query("SELECT * FROM tutors"),
      pool.query("SELECT * FROM sessions"),
      pool.query("SELECT * FROM websites"),
      pool.query("SELECT * FROM enquiries ORDER BY created_at ASC")
    ]);
    return {
      tutors: tutors.rows.map(row => ({ id: row.id, email: row.email, phone: row.phone || "", passwordHash: row.password_hash, createdAt: row.created_at.toISOString() })),
      sessions: sessions.rows.map(row => ({ token: row.token, tutorId: row.tutor_id, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString() })),
      websites: websites.rows.map(row => ({ id: row.id, tutorId: row.tutor_id, slug: row.slug || "", customDomain: row.custom_domain || "", domainStatus: row.domain_status || "not_connected", draftTemplate: row.draft_template, publishedTemplate: row.published_template, publishedAt: row.published_at ? row.published_at.toISOString() : "", lastDomainCheckAt: row.last_domain_check_at ? row.last_domain_check_at.toISOString() : "" })),
      enquiries: enquiries.rows.map(row => ({ id: row.id, websiteId: row.website_id, slug: row.slug || "", name: row.name || "", phone: row.phone || "", email: row.email || "", message: row.message || "", status: row.status || "new", createdAt: row.created_at.toISOString() }))
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
          `INSERT INTO tutors (id,email,phone,password_hash,created_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, phone=EXCLUDED.phone, password_hash=EXCLUDED.password_hash`,
          [tutor.id, tutor.email, tutor.phone || "", tutor.passwordHash, tutor.createdAt]
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
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#0f172a;background:${escapeHtml(t.pageBg || "#fff")}}a{text-decoration:none;color:inherit}.site-nav{height:74px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 28px;border-bottom:1px solid #e5e7eb;background:#fff}.brand{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:1000}.brand img{width:42px;height:42px;border-radius:10px;object-fit:cover}.links{display:flex;gap:22px;color:#475569;font-weight:900}.pill,.btn{border:0;border-radius:999px;background:#0f172a;color:#fff;font-weight:900;padding:12px 18px;cursor:pointer}.teal{background:linear-gradient(120deg,#0ea5a3,#22d3ee)}.hero{display:grid;grid-template-columns:1.03fr .97fr;gap:34px;align-items:center;padding:54px 42px;background:linear-gradient(135deg,${escapeHtml(t.sectionBg || "#f4fdfc")} 0%,#fff 55%,#fff7dc 100%)}.kicker{font-size:13px;font-weight:1000;text-transform:uppercase;letter-spacing:.07em;color:#0ea5a3}.title{font-size:clamp(40px,5vw,66px);line-height:1.02;margin:12px 0}.lead{font-size:18px;line-height:1.7;color:#475569;max-width:560px}.photo{position:relative;height:380px;border-radius:30px;overflow:hidden;box-shadow:0 24px 60px rgba(2,8,23,.16)}.photo img{width:100%;height:100%;object-fit:cover}.float{position:absolute;border:1px solid #e5e7eb;border-radius:18px;background:#fff;box-shadow:0 14px 32px rgba(2,8,23,.14);padding:14px;font-weight:900}.left{left:${Number(t.experienceX || 18)}px;top:${Number(t.experienceY || 18)}px}.right{right:${Number(t.pricingX || 24)}px;bottom:${Number(t.pricingY || 24)}px}.band{padding:${Number(t.spacing || 34)}px 42px;border-top:1px solid #e5e7eb}.tint{background:linear-gradient(135deg,#f8fbff,#f4fdfc)}.columns,.reviews-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.mini,.review-card{border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fff}.stars{color:#f6b51e}.contact{display:flex;align-items:center;justify-content:space-between;gap:18px;background:#0f172a;color:#fff}.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.54);padding:18px}.modal.active{display:flex}.card{width:min(520px,100%);background:#fff;color:#0f172a;border-radius:18px;padding:22px}.form{display:grid;gap:12px}.input{width:100%;border:1px solid #e5e7eb;border-radius:14px;padding:14px;font-size:16px}@media(max-width:900px){.hero,.columns,.reviews-grid{grid-template-columns:1fr}.links,.pill,.float{display:none}.hero,.band{padding:28px 20px}.photo{height:260px}.contact{display:grid}.btn{width:100%}}
  </style></head><body><nav class="site-nav"><strong class="brand">${t.logoUrl ? `<img src="${escapeHtml(t.logoUrl)}" alt="">` : ""}<span>${escapeHtml(t.instituteName)}</span></strong><div class="links">${nav}</div><a class="pill" href="#contact">Get started</a></nav><main><section class="hero"><div><div class="kicker">${escapeHtml(t.kicker)}</div><h1 class="title">${escapeHtml(t.headline)}</h1><p class="lead">By ${escapeHtml(t.tutorName || "Tutor")} · ${escapeHtml(t.subhead)}</p><button class="btn" id="heroInquiry">${escapeHtml(t.ctaButton || "Book Demo")}</button></div><div class="photo"><img src="${escapeHtml(t.imageUrl || defaultImage)}" alt="Tutor website image">${t.showExperienceBadge === "on" ? `<div class="float left">${escapeHtml(t.experience)}<br><span>Structured learning</span></div>` : ""}${t.showPricingBadge === "on" ? `<div class="float right">${escapeHtml(t.pricing)}<br><span>Demo available</span></div>` : ""}</div></section>${sections}</main><div class="modal" id="modal"><div class="card"><h2>${escapeHtml(t.inquiryTitle || "Send an inquiry")}</h2><form class="form" id="inquiryForm">${t.inquiryName === "on" ? '<input class="input" name="name" placeholder="Name" required>' : ""}${t.inquiryPhone === "on" ? '<input class="input" name="phone" placeholder="Phone / WhatsApp" required>' : ""}${t.inquiryEmail === "on" ? '<input class="input" name="email" type="email" placeholder="Email">' : ""}${t.inquiryMessage === "on" ? '<textarea class="input" name="message" rows="4" placeholder="What help do you need?"></textarea>' : ""}<button class="btn teal" type="submit">Submit Inquiry</button><button class="btn" type="button" id="closeModal">Close</button><p id="thanks" style="display:none;color:green;font-weight:900">Inquiry sent.</p></form></div></div><script>
  const modal=document.getElementById("modal");document.getElementById("openInquiry")?.addEventListener("click",()=>modal.classList.add("active"));document.getElementById("heroInquiry")?.addEventListener("click",()=>modal.classList.add("active"));document.getElementById("closeModal").addEventListener("click",()=>modal.classList.remove("active"));document.getElementById("inquiryForm").addEventListener("submit",async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());await fetch("/api/site/${escapeHtml(website.slug)}/enquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});document.getElementById("thanks").style.display="block";e.currentTarget.reset()});
  </script></body></html>`;
}

function serveFile(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!PUBLIC_FILES.has(url.pathname) && !PUBLIC_FILES.has(pathname)) return false;
  const file = path.join(ROOT, pathname);
  if (!fs.existsSync(file)) return false;
  const type = pathname.endsWith(".css") ? "text/css" : pathname.endsWith(".png") ? "image/png" : pathname.endsWith(".ico") ? "image/x-icon" : "text/html; charset=utf-8";
  res.writeHead(200, {"Content-Type": type});
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  const db = await readDb();
  if (req.method === "POST" && url.pathname === "/api/signup") {
    const data = await bodyJson(req);
    const email = String(data.email || "").trim().toLowerCase();
    if (!email || !data.password) return sendJson(res, 400, { error: "Email and password required" });
    let tutor = db.tutors.find(item => item.email === email);
    if (tutor) return sendJson(res, 409, { error: "Account already exists. Please log in." });
    tutor = { id: id("tutor"), email, phone: data.phone || "", passwordHash: hashPassword(data.password), createdAt: new Date().toISOString() };
    const website = { id: id("site"), tutorId: tutor.id, slug: "", customDomain: "", domainStatus: "not_connected", draftTemplate: templateFromSignup(data), publishedTemplate: null, publishedAt: "" };
    db.tutors.push(tutor);
    db.websites.push(website);
    const token = id("sess");
    db.sessions.push({ token, tutorId: tutor.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
    await writeDb(db);
    return sendJson(res, 201, { tutor: { id: tutor.id, email: tutor.email }, website: publicWebsite(website) }, {"Set-Cookie": `th_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`});
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    const data = await bodyJson(req);
    const tutor = db.tutors.find(item => item.email === String(data.email || "").trim().toLowerCase());
    if (!tutor || !verifyPassword(data.password, tutor.passwordHash)) return sendJson(res, 401, { error: "Invalid email or password" });
    const token = id("sess");
    db.sessions.push({ token, tutorId: tutor.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() });
    await writeDb(db);
    return sendJson(res, 200, { tutor: { id: tutor.id, email: tutor.email } }, {"Set-Cookie": `th_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`});
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = parseCookies(req).th_session;
    const next = { ...db, sessions: db.sessions.filter(session => session.token !== token) };
    await writeDb(next);
    return sendJson(res, 200, { ok: true }, {"Set-Cookie": "th_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"});
  }
  if (req.method === "GET" && url.pathname === "/api/me") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    return sendJson(res, 200, { tutor: { id: tutor.id, email: tutor.email, phone: tutor.phone }, website: publicWebsite(website) });
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
    await writeDb(db);
    return sendJson(res, 200, { website: publicWebsite(website), message: "DNS verification queued. Production will check CNAME/TXT records here." });
  }
  if (req.method === "GET" && url.pathname === "/api/enquiries") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    return sendJson(res, 200, { enquiries: db.enquiries.filter(item => item.websiteId === website.id) });
  }
  if (req.method === "DELETE" && url.pathname === "/api/enquiries") {
    const tutor = requireTutor(req, res, db);
    if (!tutor) return;
    const website = db.websites.find(item => item.tutorId === tutor.id);
    db.enquiries = db.enquiries.filter(item => item.websiteId !== website.id);
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }
  const enquiryMatch = url.pathname.match(/^\/api\/site\/([^/]+)\/enquiries$/);
  if (req.method === "POST" && enquiryMatch) {
    const slug = enquiryMatch[1];
    const website = db.websites.find(item => item.slug === slug || item.customDomain === req.headers.host);
    if (!website || !website.publishedTemplate) return sendJson(res, 404, { error: "Published website not found" });
    const data = await bodyJson(req);
    const enquiry = { id: id("enq"), websiteId: website.id, slug: website.slug, name: data.name || "", phone: data.phone || "", email: data.email || "", message: data.message || "", createdAt: new Date().toISOString(), status: "new" };
    db.enquiries.push(enquiry);
    await writeDb(db);
    return sendJson(res, 201, { enquiry });
  }
  notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
    const hostSlug = subdomainSlug(req.headers.host);
    if (hostSlug && url.pathname === "/") {
      const db = await readDb();
      const website = db.websites.find(item => item.slug === hostSlug && item.publishedTemplate);
      const html = website && renderSite(website);
      if (!html) return send(res, 404, "<h1>Website not published yet</h1>");
      return send(res, 200, html);
    }
    const siteMatch = url.pathname.match(/^\/site\/([^/]+)$/);
    if (siteMatch) {
      const db = await readDb();
      const website = db.websites.find(item => item.slug === siteMatch[1]);
      const html = website && renderSite(website);
      if (!html) return send(res, 404, "<h1>Website not published yet</h1>");
      return send(res, 200, html);
    }
    const db = await readDb();
    const domainWebsite = db.websites.find(item => item.customDomain && cleanHost(item.customDomain) === cleanHost(req.headers.host) && item.publishedTemplate);
    if (domainWebsite && url.pathname === "/") return send(res, 200, renderSite(domainWebsite));
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
