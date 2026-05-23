// ============================================================
// score-core.js — Claude editorial scoring
// ============================================================

const NOW_STR = () => new Date().toUTCString();

const PROMPTS = {
  F1: () => `You are the F1 editor. Today is ${NOW_STR()}.
Score 0-10 by SPECIFICITY and CONFIRMED FACT:
10 = confirmed driver signing/sacking with team named, race result, FIA penalty issued
8-9 = confirmed contract extension with name, team principal change, factory news with figures
7   = official team announcement with concrete impact
0-6 = REJECT: quotes, opinions, "could", "set to", previews, technical analyses, speculation
Return ONLY stories scoring 7+. JSON: [{"idx":0,"title":"rewritten max 12 words","score":9}]. Return [] if none qualify.`,

  FOOTBALL: () => `You are the Football editor. Today is ${NOW_STR()}.
Top 5 leagues + Champions League ONLY. Score 0-10:
10 = title won, confirmed major sacking, confirmed transfer with fee
8-9 = confirmed transfer with player name AND club, ban/expulsion, decisive cup result
7   = confirmed managerial appointment with named club
0-6 = REJECT: quotes, "linked", "could", player ratings, previews, World Cup squad rumour
Return ONLY 7+. JSON: [{"idx":0,"title":"max 12 words","score":9}]. Return [] if none.`,

  BAYERN: () => `You are the Bayern Munich editor. Today is ${NOW_STR()}.
MUST be specifically about FC Bayern Munich men's first team.
10 = confirmed transfer with fee, manager sacked/appointed
8-9 = confirmed injury with timeline, major match result with title implication
7   = official Bayern statement with concrete content
0-6 = REJECT: quotes, women's team, U19, Germany NT, "linked" rumour, previews
Return ONLY 7+. JSON: [{"idx":0,"title":"max 12 words","score":9}]. Return [] if none.`,

  SPL: () => `You are the Saudi Pro League editor. Today is ${NOW_STR()}.
10 = title clinched, confirmed major signing
8-9 = match with title-race impact naming Al Hilal/Nassr/Ittihad/Ahli, confirmed sacking
7   = confirmed squad news with specific named player
0-6 = REJECT: manager quotes, previews, stories not naming a specific SPL team
Return ONLY 7+. JSON: [{"idx":0,"title":"max 12 words","score":9}]. Return [] if none.`,

  KSA: () => `You are the Saudi Arabia editor (economy, PIF, Vision 2030). Today is ${NOW_STR()}.
10 = confirmed multi-billion deal with figures, major royal decree with economic impact
8-9 = PIF announcement with numbers, Vision 2030 milestone with data
7   = confirmed economic stat with numbers
0-6 = REJECT: diplomatic visits without outcome, religious/Hajj, tourism without dollar figures, aid stories
Return ONLY 7+. JSON: [{"idx":0,"title":"max 12 words","score":9}]. Return [] if none.`,
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
      .filter(s => s.score >= 7)
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
