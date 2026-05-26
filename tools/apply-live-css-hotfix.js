const { Pool } = require("pg");

const HOTFIX_CSS = [
  "#ffffff}",
  "/*th-v4-hotfix*/",
  ".site-nav{min-height:78px!important;height:auto!important;display:grid!important;grid-template-columns:minmax(260px,1fr) minmax(0,auto) auto!important;align-items:center!important;gap:16px!important;padding:14px max(24px,calc((100vw - 1180px)/2))!important}",
  ".brand{font-size:clamp(20px,2vw,24px)!important;line-height:1.08!important;max-width:520px!important}",
  ".links{display:flex!important;align-items:center!important;justify-content:flex-end!important;flex-wrap:wrap!important;gap:10px 18px!important;line-height:1.12!important}",
  ".links a{white-space:nowrap!important}",
  "#courses strong:first-child,#reviews strong:first-child,#contact strong:first-child{display:block!important;font-size:clamp(42px,5vw,64px)!important;line-height:1.02!important;margin:0 0 14px!important;color:#071126!important;font-weight:1000!important}",
  "#contact strong:first-child{color:#fff!important}",
  "#courses p:first-of-type,#contact p{font-size:20px!important;line-height:1.6!important;max-width:780px!important}",
  "#courses .course-body strong{font-size:18px!important;line-height:1.25!important;margin:0!important;color:#0f172a!important}",
  "#courses .course-body p{font-size:18px!important;line-height:1.55!important}",
  "@media(max-width:1120px){.site-nav{grid-template-columns:1fr auto!important}.links{grid-column:1/-1!important;justify-content:flex-start!important}.pill{grid-column:2!important;grid-row:1!important}}",
  "@media(max-width:820px){.site-nav{display:flex!important;align-items:flex-start!important;flex-direction:column!important;padding:18px 20px!important}.links{justify-content:flex-start!important;gap:12px!important}.pill{display:none!important}#courses strong:first-child,#reviews strong:first-child,#contact strong:first-child{font-size:clamp(34px,10vw,44px)!important}#courses p:first-of-type,#contact p{font-size:17px!important}}",
  "body{background:#ffffff"
].join("");

function applyHotfix(template) {
  if (!template || typeof template !== "object") return template;
  return { ...template, pageBg: HOTFIX_CSS };
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
    for (const row of rows) {
      await client.query(
        "UPDATE websites SET draft_template = $1, published_template = $2 WHERE id = $3",
        [applyHotfix(row.draft_template), row.published_template ? applyHotfix(row.published_template) : null, row.id]
      );
    }
    await client.query("COMMIT");
    console.log(`Applied live CSS hotfix to ${rows.length} website templates.`);
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
