export function scoreIncidentTemplate(template, snapshot, summary, state) {
  let score = 1;
  if (template.key === "rush-order") {
    score += summary.traffic >= 48 ? 3 : 0;
    score += snapshot.dailyGrossProfit < 100 ? 1 : 0;
    score -= snapshot.overloadRatio > 0.45 ? 1.5 : 0;
  }
  if (template.key === "supplier-price") {
    score += snapshot.dailyGrossProfit < 120 ? 3 : 0;
    score += state.cash < 120 ? 2 : 0;
    score += state.source === "goose" ? 4 : 0;
    score += state.source === "frozenDuck" ? 2 : 0;
    score += summary.risk >= 62 ? 1 : 0;
  }
  if (template.key === "rainy-evening") {
    score += snapshot.overloadRatio > 0.25 ? 2 : 0;
    score += summary.traffic < 42 ? 1 : 0;
  }
  if (template.key === "staff-fatigue") {
    score += snapshot.overloadRatio > 0.18 ? 4 : 0;
    score += state.staff >= 3 ? 1 : 0;
  }
  if (template.key === "platform-check") {
    score += summary.risk >= 58 ? 4 : 0;
    score += snapshot.complianceGap > 0.12 ? 3 : 0;
    score += state.paidTraffic > 28 ? 1 : 0;
  }
  return Math.max(0.25, score);
}

export function pickIncidentTemplate(templates, snapshot, summary, state) {
  const scored = templates.map((template) => ({
    template,
    score: scoreIncidentTemplate(template, snapshot, summary, state),
  }));
  const total = scored.reduce((sum, item) => sum + item.score, 0);
  let cursor = ((state.calendarDay * 37 + Math.round(summary.risk) * 11 + Math.round(summary.traffic) * 7) % 1000) / 1000 * total;
  for (const item of scored) {
    cursor -= item.score;
    if (cursor <= 0) return item.template;
  }
  return scored.at(-1).template;
}
