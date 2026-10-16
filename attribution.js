/* Remembers where a visit came from, so the trial form can report it even when
   the visitor lands on one page (a blog post, say) and books on another.
   Loaded with defer on every page; fills the hidden trafficSource / adClickId
   inputs on any page that has the trial form. */
(function () {
  var KEY = "th_attribution";
  var CLICK_IDS = { gclid: "Google Ads", fbclid: "Meta Ads", ttclid: "TikTok Ads", msclkid: "Microsoft Ads" };
  var GOOGLE_HOST = /^(www\.)?google\.[a-z.]+$/i;
  var SEARCH_HOST = /(^|\.)(bing|duckduckgo|yahoo|ecosia|brave|yandex|baidu|qwant|startpage)\./i;
  var AI_HOST = /^(chatgpt\.com|chat\.openai\.com|perplexity\.ai|www\.perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai)$/i;

  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function write(rec) {
    try { sessionStorage.setItem(KEY, JSON.stringify(rec)); return true; } catch (e) { return false; }
  }

  // "" means the referrer says nothing new about where the visitor came from.
  function sourceFromReferrer(ref) {
    if (!ref) return "";
    if (/^android-app:\/\/com\.google\.android\.googlequicksearchbox/i.test(ref)) return "Google Organic";
    var host;
    try { host = new URL(ref).hostname; } catch (e) { return ""; }
    if (host === location.hostname || /(^|\.)tutorhive\.in$/i.test(host)) return "";
    if (AI_HOST.test(host)) return "AI Assistant";
    if (GOOGLE_HOST.test(host)) return "Google Organic";
    if (SEARCH_HOST.test(host)) return "Other Organic";
    return "Referral";
  }

  function detect() {
    var params = new URLSearchParams(location.search);
    for (var key in CLICK_IDS) {
      var val = params.get(key);
      if (val) {
        try { sessionStorage.setItem(key, val); } catch (e) {}
        return { source: CLICK_IDS[key], adClickId: key + "=" + val };
      }
    }
    var source = sourceFromReferrer(document.referrer);
    return source ? { source: source, adClickId: "" } : null;
  }

  // The latest outside touch in this session wins; internal navigation and
  // direct hits never overwrite it. "Direct" is only claimed when it can be
  // remembered, otherwise the page's own fallback stays in place.
  var found = detect();
  var saved = read();
  var rec = found || saved;
  if (found) write(found);
  else if (!saved) {
    var direct = { source: "Direct", adClickId: "" };
    if (write(direct)) rec = direct;
  }

  function fill() {
    if (!rec) return;
    var i, sources = document.querySelectorAll("input[name='trafficSource']");
    var ids = document.querySelectorAll("input[name='adClickId']");
    for (i = 0; i < sources.length; i++) sources[i].value = rec.source;
    for (i = 0; i < ids.length; i++) ids[i].value = rec.adClickId || "";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
})();
