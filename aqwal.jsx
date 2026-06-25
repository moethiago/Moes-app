import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Aqwāl — "What the scholars said"
// A prototype fatwa-comparison engine: ask a question, see the spread of
// scholarly opinion, scholar by scholar, with a path to the source.
//
// Design note: the flagship example (women driving) is grounded in REAL,
// documented positions with real source links. The "Ask anything" mode is a
// live AI draft, clearly stamped as unverified — in production that call is
// replaced by grounded retrieval over an actual fatwa corpus.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  paper:    "#ECE4D2",
  paperHi:  "#F4EEE0",
  ink:      "#211C15",
  inkSoft:  "#5C5446",
  indigo:   "#27313D",
  line:     "#D4C8AE",
  vermilion:"#9E2B25", // impermissible / rubrication
  verdigris:"#2F6B5E", // permissible
  ochre:    "#B07A1E", // conditional
};

const STANCE = {
  impermissible: { label: "Impermissible", color: C.vermilion, zone: 0 },
  conditional:   { label: "Conditional",   color: C.ochre,     zone: 1 },
  permissible:   { label: "Permissible",   color: C.verdigris, zone: 2 },
};

const CURATED = {
  question: "Is it permissible for women to drive?",
  arabic: "هل يجوز للمرأة أن تقود السيارة؟",
  overview:
    "Opinion here spans a clear spectrum. Several senior scholars — including former Grand Mufti Ibn Bāz — historically held it impermissible, treating the ruling as a precaution against social harms rather than an objection to driving itself. Others held it permissible in principle, viewing the restriction as social and contextual. In 2017 the Council of Senior Scholars officially backed permissibility, and the ban was lifted in 2018.",
  positions: [
    {
      name: "ʿAbd al-ʿAzīz Ibn Bāz", arabic: "عبد العزيز بن باز",
      era: "Grand Mufti · d. 1999", stance: "impermissible",
      summary:
        "In a 1990 fatwa, held that permitting women to drive would open the way to social harms, and so should be blocked as a precaution. Some statements treated cases of necessity differently.",
      source: { label: "Library of Congress", url: "https://www.loc.gov/item/global-legal-monitor/2017-06-07/saudi-arabia-shura-council-denies-social-media-reports-on-resolution-to-allow-women-to-drive/" },
    },
    {
      name: "Ibn al-ʿUthaymīn", arabic: "محمد بن عثيمين",
      era: "Senior scholar · d. 2001", stance: "impermissible",
      summary:
        "Backed preventing it, holding that it could lead to outcomes at odds with Islamic guidance on modesty and free mixing.",
      source: { label: "Academic study (J. Fatwa Mgmt.)", url: "https://www.researchgate.net/publication/339229882_DRIVING_RESTRICTION_ON_SAUDI_WOMEN_A_COMPARATIVE_ANALYSIS_OF_MODALITY_BETWEEN_AL-JAZIRAH_AND_BBC_ARABIC_REPORTS" },
    },
    {
      name: "Ṣāliḥ al-Fawzān", arabic: "صالح الفوزان",
      era: "Senior Scholars Council", stance: "impermissible",
      summary:
        "Held that permitting it runs against the protective role Islam assigns to women.",
      source: { label: "Academic study (J. Fatwa Mgmt.)", url: "https://www.researchgate.net/publication/339229882_DRIVING_RESTRICTION_ON_SAUDI_WOMEN_A_COMPARATIVE_ANALYSIS_OF_MODALITY_BETWEEN_AL-JAZIRAH_AND_BBC_ARABIC_REPORTS" },
    },
    {
      name: "ʿAbd al-Muḥsin al-ʿUbaykān", arabic: "عبد المحسن العبيكان",
      era: "Senior Scholars member", stance: "permissible",
      summary:
        "Argued the act itself is permitted; the objection is to social circumstances, not to driving as such — so the restriction is contextual, not inherent.",
      source: { label: "Arab News (2008)", url: "https://www.arabnews.com/node/309049" },
    },
    {
      name: "ʿĀʾiḍ al-Qarnī", arabic: "عائض القرني",
      era: "Preacher & author", stance: "permissible",
      summary:
        "Stated that no religious evidence prohibits it, and called for the matter to be formally reviewed.",
      source: { label: "Library of Congress", url: "https://www.loc.gov/item/global-legal-monitor/2017-06-07/saudi-arabia-shura-council-denies-social-media-reports-on-resolution-to-allow-women-to-drive/" },
    },
    {
      name: "Aḥmad ibn Bāz", arabic: "أحمد بن باز",
      era: "Researcher · son of the Grand Mufti", stance: "permissible",
      summary:
        "Argued it should be seen as a right shaped by changing circumstances rather than a fixed prohibition.",
      source: { label: "Al Arabiya (2010)", url: "https://english.alarabiya.net/articles/2010/05/25/109562" },
    },
    {
      name: "Council of Senior Scholars", arabic: "هيئة كبار العلماء",
      era: "Official · 2017", stance: "permissible", official: true,
      summary:
        "Officially backed the decree permitting women to drive, stating it is permissible in origin and that earlier fatwas weighed benefits and harms within their own context.",
      source: { label: "The New Arab (2017)", url: "https://www.newarab.com/News/2017/9/27/Saudi-religious-authorities-back-women-driving-contradicting-years-of-opposition" },
    },
  ],
};

const PRESETS = [
  "Is it permissible for women to drive?",
  "What is the ruling on music?",
  "Is cryptocurrency trading allowed?",
  "Can you fast while travelling?",
];

export default function Aqwal() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState({ status: "idle" }); // idle|curated|loading|live|error
  const [filter, setFilter] = useState(null);
  const cardsRef = useRef({});

  const norm = (s) => s.toLowerCase().replace(/[^\w]/g, "");
  const isCurated = (q) =>
    norm(q).includes("womendriv") || norm(q).includes("womandriv") ||
    norm(q).includes("femaledriv");

  async function ask(q) {
    const question = (q ?? query).trim();
    if (!question) return;
    setQuery(question);
    setFilter(null);
    if (isCurated(question)) { setView({ status: "curated", data: CURATED }); return; }

    setView({ status: "loading" });
    try {
      const prompt =
        `You are a research aid that summarizes the RANGE of documented Islamic scholarly opinion on a question. ` +
        `Return ONLY valid JSON, no markdown, matching: ` +
        `{"overview": string, "positions": [{"name": string, "arabic": string, "era": string, ` +
        `"stance": "impermissible"|"conditional"|"permissible", "summary": string, "confidence": "documented"|"uncertain"}]}. ` +
        `Rules: summarize well-known, documented positions; do NOT invent verbatim quotes; ` +
        `if unsure a named scholar held a view, mark confidence "uncertain"; present the spectrum evenhandedly; ` +
        `summaries 1–2 sentences; 3–6 positions. This is not a fatwa.\n\nQuestion: ${question}`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setView({ status: "live", data: parsed });
    } catch (e) {
      setView({ status: "error" });
    }
  }

  const data = view.data;
  const positions = data?.positions ?? [];
  const shown = filter ? positions.filter((p) => p.stance === filter) : positions;
  const counts = positions.reduce((a, p) => ((a[p.stance] = (a[p.stance] || 0) + 1), a), {});
  const live = view.status === "live";

  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100%", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .aq-wrap { max-width: 760px; margin: 0 auto; padding: 28px 20px 64px; }
        .aq-input:focus-visible, .aq-btn:focus-visible, .aq-chip:focus-visible, .aq-src:focus-visible { outline: 2px solid ${C.indigo}; outline-offset: 2px; }
        .aq-card { animation: aqRise .5s cubic-bezier(.2,.7,.2,1) both; }
        .aq-src { color: ${C.indigo}; text-decoration: none; border-bottom: 1px solid ${C.line}; }
        .aq-src:hover { border-bottom-color: ${C.indigo}; }
        .aq-chip:hover { background: ${C.paperHi}; }
        @keyframes aqRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes aqFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .aq-card, .aq-track i { animation: none !important; } }
      `}</style>

      <div className="aq-wrap">
        {/* Masthead */}
        <header style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Amiri', serif", fontSize: 34, fontWeight: 700, color: C.indigo, lineHeight: 1 }}>أقوال</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 27, fontWeight: 600, letterSpacing: "-0.01em" }}>Aqwāl</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.14em", marginLeft: "auto" }}>What the scholars said</span>
          </div>
          <p style={{ margin: "10px 0 0", color: C.inkSoft, fontSize: 15, maxWidth: 560 }}>
            Ask a question. See the spread of scholarly opinion — scholar by scholar — then go to the source.
          </p>
        </header>

        {/* Ask */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            className="aq-input"
            aria-label="Ask a religious question"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask a question…"
            style={{ flex: 1, background: C.paperHi, border: `1px solid ${C.line}`, borderRadius: 2, padding: "13px 15px", fontSize: 16, color: C.ink, fontFamily: "inherit" }}
          />
          <button className="aq-btn" onClick={() => ask()} aria-label="Ask"
            style={{ background: C.indigo, color: C.paperHi, border: "none", borderRadius: 2, padding: "0 20px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Ask
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 30 }}>
          {PRESETS.map((p) => (
            <button key={p} className="aq-chip" onClick={() => ask(p)}
              style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 100, padding: "6px 13px", fontSize: 13, color: C.inkSoft, cursor: "pointer", fontFamily: "inherit" }}>
              {p}
            </button>
          ))}
        </div>

        {/* States */}
        {view.status === "idle" && (
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 26, color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              Try the grounded example — <b style={{ color: C.ink }}>“Is it permissible for women to drive?”</b> — to see the format with real, sourced positions. Other questions run a live AI draft, clearly marked for verification.
            </p>
          </div>
        )}

        {view.status === "loading" && (
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.inkSoft }}>Gathering positions…</p>
        )}

        {view.status === "error" && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 2, padding: 16, fontSize: 14 }}>
            Couldn’t reach the live model. The grounded example still works — try “Is it permissible for women to drive?”
          </div>
        )}

        {(view.status === "curated" || live) && data && (
          <div>
            {/* provenance banner */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase",
              color: live ? C.vermilion : C.verdigris }}>
              <span style={{ width: 7, height: 7, borderRadius: 100, background: "currentColor" }} />
              {live ? "AI draft · unverified — confirm with primary sources" : "Grounded · positions summarized from cited sources"}
            </div>

            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 23, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{query}</h2>
            {data.arabic && <p style={{ fontFamily: "'Amiri', serif", fontSize: 18, color: C.inkSoft, margin: "0 0 16px", direction: "rtl" }}>{data.arabic}</p>}

            {/* Overview */}
            <p style={{ fontFamily: "'Amiri', serif", fontSize: 17.5, lineHeight: 1.7, margin: "0 0 26px", color: C.ink }}>{data.overview}</p>

            {/* Signature: the opinion spread */}
            <Spread counts={counts} positions={positions} filter={filter} setFilter={setFilter}
              jump={(i) => cardsRef.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })} />

            {/* Cards */}
            <div style={{ marginTop: 8 }}>
              {shown.map((p, i) => {
                const realIndex = positions.indexOf(p);
                const st = STANCE[p.stance] || STANCE.conditional;
                return (
                  <article key={realIndex} ref={(el) => (cardsRef.current[realIndex] = el)} className="aq-card"
                    style={{ animationDelay: `${i * 60}ms`, borderTop: `1px solid ${C.line}`, padding: "20px 0" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18.5, fontWeight: 600, margin: 0 }}>{p.name}</h3>
                          {p.arabic && <span style={{ fontFamily: "'Amiri', serif", fontSize: 17, color: C.inkSoft, direction: "rtl" }}>{p.arabic}</span>}
                          {p.official && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.indigo, border: `1px solid ${C.line}`, borderRadius: 2, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Official</span>}
                        </div>
                        {p.era && <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: C.inkSoft, margin: "4px 0 0", letterSpacing: "0.02em" }}>{p.era}</p>}
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, fontWeight: 600, color: st.color, border: `1px solid ${st.color}`, borderRadius: 100, padding: "4px 11px", whiteSpace: "nowrap" }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 15.5, lineHeight: 1.62, margin: "12px 0 0", color: C.ink, maxWidth: 620 }}>{p.summary}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                      {p.source?.url && (
                        <a className="aq-src" href={p.source.url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {p.source.label} ↗
                        </a>
                      )}
                      {live && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: p.confidence === "uncertain" ? C.vermilion : C.inkSoft }}>
                          {p.confidence === "uncertain" ? "⚠ unverified attribution" : "AI summary · verify"}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <p style={{ borderTop: `1px solid ${C.line}`, marginTop: 8, paddingTop: 18, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
              Aqwāl is a research aid for comparing scholarly opinion — not a fatwā. Rulings depend on context; consult a qualified scholar for personal guidance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spread({ counts, positions, filter, setFilter, jump }) {
  const order = ["impermissible", "conditional", "permissible"];
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
        The spread of opinion
      </div>
      <div className="aq-track" style={{ position: "relative", height: 4, background: `linear-gradient(90deg, ${C.vermilion}, ${C.ochre}, ${C.verdigris})`, borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
        <i style={{ display: "block", height: "100%", transformOrigin: "left", animation: "aqFill .7s cubic-bezier(.2,.7,.2,1) both", background: "transparent" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {order.map((s) => {
          const st = STANCE[s];
          const items = positions.filter((p) => p.stance === s);
          const active = filter === s;
          return (
            <button key={s} className="aq-chip" onClick={() => setFilter(active ? null : s)}
              aria-pressed={active}
              style={{ textAlign: "left", background: active ? C.paperHi : "transparent", border: `1px solid ${active ? st.color : C.line}`, borderRadius: 3, padding: "10px 11px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 100, background: st.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: st.color }}>{st.label}</span>
                <span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {items.map((p) => (
                  <span key={p.name} onClick={(e) => { e.stopPropagation(); jump(positions.indexOf(p)); }}
                    style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>
                    {p.name}
                  </span>
                ))}
                {items.length === 0 && <span style={{ fontSize: 11.5, color: C.line }}>—</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}