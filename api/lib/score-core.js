// ============================================================
// score-core.js — Claude editorial scoring
// Philosophy: judge the EVENT, not the wording. A real confirmed
// development passes even if the headline hedges ("could", "set to").
// Reject only genuine speculation, opinion, and clickbait.
// ============================================================

const NOW_STR = () => new Date().toUTCString();

const COMMON_RULES = `
PROCESS — follow this ORDER for every candidate (critical):
STEP 1 — REWRITE FIRST. Before judging, rewrite the headline into an objective, factual news-wire version. Strip clickbait, hype, emotional verbs, and vague hooks. Expose the REAL subject the original may be hiding. Translate any Arabic to English. Use ONLY facts present in the headline/source — never invent names, numbers, or outcomes.
STEP 2 — THEN SCORE the REWRITTEN version (not the original). Judge whether the clean, factual story describes real news. This prevents good stories from being rejected just because their original headline was baity.
STEP 3 — KEEP or REJECT based on the rewrite.

REWRITING RULES:
- Remove emotional/sensational verbs: "slams","destroys","blasts","shocking","devastating","erupts","breaks silence","in tears". State the plain action instead.
- Un-hide vague hooks: "one insider says X" -> state X directly; "this changes everything" -> state what changed. If you cannot identify the real subject from the text, the rewrite is impossible -> REJECT.
- Convert questions to statements only if the answer is in the text; otherwise REJECT.

REJECT (score 0) AFTER attempting the rewrite if:
- The rewritten story has no clear WHO / WHAT / WHEN — i.e. no concrete, named, verifiable development.
- It is a personal anecdote with no hard news ("how I quit my job"), an opinion/column, a rating/ranking listicle, or a "fans react" piece.
- The only content was the hook itself and nothing factual remains after stripping it.

SCORING the clean rewrite:
- Approve any genuine, concrete development from a trusted source: results, signings, sackings, injuries, official statements, confirmed talks, real reporting with a named subject. Hedge words ("could","set to","in talks") are fine if the event is real.
- A candidate whose source begins with "x.com/" is a tweet from a TRUSTED curated account. Still rewrite it the same way and score it; reject only if nothing factual survives the rewrite.
- Be generous with real developments; be strict on fluff that survives rewriting.`;

const PROMPTS = {
  F1: () => `You are the F1 editor. Today is ${NOW_STR()}.${COMMON_RULES}
10 = confirmed driver signing/sacking, race/session result, FIA penalty
8-9 = contract news, team principal/staff change, factory or technical news with substance
6-7 = any concrete F1 development naming a driver/team (result, update, statement, confirmed talks)
0-5 = REJECT: opinion columns, driver rating lists, "fans react", pure clickbait, contentless speculation
For each story that survives: "title" = your objective factual REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  FOOTBALL: () => `You are the Football editor. Today is ${NOW_STR()}.${COMMON_RULES}
Top 5 European leagues + Champions League focus.
10 = title decided, major sacking, transfer with fee confirmed
8-9 = transfer/loan with player+club named, ban, big match result, managerial change
6-7 = any concrete development naming a club/player (result, injury, lineup, confirmed talks, official statement)
0-5 = REJECT: opinion/columns, player rating lists, "fans react", pure clickbait, vague rumour with no named subject
For each story that survives: "title" = your objective factual REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  BAYERN: () => `You are the Bayern Munich editor. Today is ${NOW_STR()}.${COMMON_RULES}
MUST relate to FC Bayern Munich men's first team.
10 = transfer with fee, manager sacked/appointed
8-9 = injury with timeline, big match result, contract confirmed
6-7 = any concrete Bayern first-team development (result, lineup, statement, confirmed talks)
0-5 = REJECT: women's team, U19/youth, Germany NT-only stories, opinion, clickbait
For each story that survives: "title" = your objective factual REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  SPL: () => `You are the Saudi Pro League editor. Today is ${NOW_STR()}.${COMMON_RULES}
Some headlines arrive in Arabic — TRANSLATE them and write the "title" in clear English. Judge them by the same bar as English ones; do NOT reject a story just because it was Arabic.
10 = title clinched, major signing confirmed
8-9 = result with title impact naming Al Hilal/Nassr/Ittihad/Ahli, sacking
6-7 = any concrete development naming a specific SPL club (result, signing, statement, confirmed talks)
0-5 = REJECT: opinion, clickbait, stories not naming a specific SPL team
For each story that survives: "title" = your objective factual English REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,

  KSA: () => `You are the Saudi Arabia editor (economy, PIF, Vision 2030). Today is ${NOW_STR()}.${COMMON_RULES}
Some headlines arrive in Arabic — TRANSLATE them and write the "title" in clear English. Judge them by the same bar as English ones; do NOT reject a story just because it was Arabic.
10 = multi-billion deal with figures, major royal decree with economic impact
8-9 = PIF announcement with numbers, Vision 2030 milestone with data
6-7 = any concrete economic/policy development (investment, initiative, deal, official announcement)
0-5 = REJECT: pure opinion, religious/Hajj logistics, fluff tourism pieces with no substance, clickbait
For each story that survives: "title" = your objective factual English REWRITE (max 12 words), "score" = score of that rewrite. JSON: [{"idx":0,"title":"...","score":8}]. Return [] if nothing survives the rewrite.`,
};

export async function scoreCategory(items, cat, apiKey) {
  if (!apiKey || !items.length) return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
  const lines = items.map((item, i) => {
    const src = (item.sourceUrl || '').indexOf('x.com/') !== -1 ? ' [source: ' + item.sourceUrl + ']' : '';
    return i + ' | ' + item.title + src;
  }).join('\n');
  const prompt = (PROMPTS[cat] || PROMPTS.FOOTBALL)() + '\n\nCandidates:\n' + lines + '\n\nReturn ONLY valid JSON.';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
    const data = await res.json();

    const inputTokens  = data.usage?.input_tokens  || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    // Haiku 4.5 pricing: $1/MTok input, $5/MTok output (approx)
    const cost = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;

    const text  = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return { approved: [], cost, inputTokens, outputTokens };

    const scored = JSON.parse(match[0])
      .map(s => {
        const idx = parseInt(s.idx);
        if (isNaN(idx) || !items[idx]) return null;
        return {
          ...items[idx],
          score: s.score,
          rewritten: (s.title && s.title.trim()) || items[idx].title,
        };
      })
      .filter(Boolean)
      // Tweets come from curated, trusted accounts — let them through at a
      // lower bar (>=3). Everything else keeps the normal bar (>=5).
      .filter(s => {
        const isTweet = (s.sourceUrl || '').indexOf('x.com/') !== -1;
        return s.score >= 5;  // same bar for all; rewrite gave each a fair shot
      });

    return { approved: scored, cost, inputTokens, outputTokens };
  } catch (e) {
    return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
  }
}