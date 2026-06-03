// ============================================================
// score-core.js — Claude editorial scoring
// Philosophy: judge the EVENT, not the wording. A real confirmed
// development passes even if the headline hedges ("could", "set to").
// Reject only genuine speculation, opinion, and clickbait.
// ============================================================

const NOW_STR = () => new Date().toUTCString();

const COMMON_RULES = `
SCORING PHILOSOPHY:
- Judge the underlying EVENT, not the headline's wording. Hedge words like "could", "set to", "linked", "in talks" do NOT auto-reject — many real confirmed stories are written that way.
- Approve any genuine, concrete development from a trusted source: results, signings, sackings, injuries, official statements, confirmed talks, real reporting with a named subject.
- Reject ONLY: pure opinion/columns, ratings/rankings listicles, "X reacts" reaction pieces, clickbait, vague speculation with no concrete subject, and obvious duplicates.
- When unsure but the story names a real team/person and a real event, lean APPROVE (score 6-7).
- Be generous with volume; be strict on junk.`;

const PROMPTS = {
  F1: () => `You are the F1 editor. Today is ${NOW_STR()}.${COMMON_RULES}
10 = confirmed driver signing/sacking, race/session result, FIA penalty
8-9 = contract news, team principal/staff change, factory or technical news with substance
6-7 = any concrete F1 development naming a driver/team (result, update, statement, confirmed talks)
0-5 = REJECT: opinion columns, driver rating lists, "fans react", pure clickbait, contentless speculation
Return stories scoring 6+. JSON: [{"idx":0,"title":"rewritten max 12 words","score":8}]. Return [] only if genuinely nothing qualifies.`,

  FOOTBALL: () => `You are the Football editor. Today is ${NOW_STR()}.${COMMON_RULES}
Top 5 European leagues + Champions League focus.
10 = title decided, major sacking, transfer with fee confirmed
8-9 = transfer/loan with player+club named, ban, big match result, managerial change
6-7 = any concrete development naming a club/player (result, injury, lineup, confirmed talks, official statement)
0-5 = REJECT: opinion/columns, player rating lists, "fans react", pure clickbait, vague rumour with no named subject
Return stories scoring 6+. JSON: [{"idx":0,"title":"max 12 words","score":8}]. Return [] only if genuinely nothing qualifies.`,

  BAYERN: () => `You are the Bayern Munich editor. Today is ${NOW_STR()}.${COMMON_RULES}
MUST relate to FC Bayern Munich men's first team.
10 = transfer with fee, manager sacked/appointed
8-9 = injury with timeline, big match result, contract confirmed
6-7 = any concrete Bayern first-team development (result, lineup, statement, confirmed talks)
0-5 = REJECT: women's team, U19/youth, Germany NT-only stories, opinion, clickbait
Return stories scoring 6+. JSON: [{"idx":0,"title":"max 12 words","score":8}]. Return [] only if genuinely nothing qualifies.`,

  SPL: () => `You are the Saudi Pro League editor. Today is ${NOW_STR()}.${COMMON_RULES}
10 = title clinched, major signing confirmed
8-9 = result with title impact naming Al Hilal/Nassr/Ittihad/Ahli, sacking
6-7 = any concrete development naming a specific SPL club (result, signing, statement, confirmed talks)
0-5 = REJECT: opinion, clickbait, stories not naming a specific SPL team
Return stories scoring 6+. JSON: [{"idx":0,"title":"max 12 words","score":8}]. Return [] only if genuinely nothing qualifies.`,

  KSA: () => `You are the Saudi Arabia editor (economy, PIF, Vision 2030). Today is ${NOW_STR()}.${COMMON_RULES}
10 = multi-billion deal with figures, major royal decree with economic impact
8-9 = PIF announcement with numbers, Vision 2030 milestone with data
6-7 = any concrete economic/policy development (investment, initiative, deal, official announcement)
0-5 = REJECT: pure opinion, religious/Hajj logistics, fluff tourism pieces with no substance, clickbait
Return stories scoring 6+. JSON: [{"idx":0,"title":"max 12 words","score":8}]. Return [] only if genuinely nothing qualifies.`,
};

export async function scoreCategory(items, cat, apiKey) {
  if (!apiKey || !items.length) return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
  const lines = items.map((item, i) => i + ' | ' + item.title).join('\n');
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
      .filter(s => s.score >= 5)
      .map(s => {
        const idx = parseInt(s.idx);
        if (isNaN(idx) || !items[idx]) return null;
        return {
          ...items[idx],
          score: s.score,
          rewritten: (s.title && s.title.trim()) || items[idx].title,
        };
      })
      .filter(Boolean);

    return { approved: scored, cost, inputTokens, outputTokens };
  } catch (e) {
    return { approved: [], cost: 0, inputTokens: 0, outputTokens: 0 };
  }
}
