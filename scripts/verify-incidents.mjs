import { initialState } from "../src/config.js";
import { operatingSnapshot } from "../src/economy.js";
import { scoreIncidentTemplate } from "../src/incidents.js";
import { metricSummary } from "./simulation.mjs";

const templates = [
  { key: "rush-order" },
  { key: "supplier-price" },
  { key: "rainy-evening" },
  { key: "staff-fatigue" },
  { key: "platform-check" },
];

function scoresFor(statePatch) {
  const state = structuredClone(initialState);
  Object.assign(state, statePatch);
  if (statePatch.markets) state.markets = { ...initialState.markets, ...statePatch.markets };
  const snapshot = operatingSnapshot(state);
  const summary = metricSummary(state);
  return Object.fromEntries(templates.map((template) => [template.key, scoreIncidentTemplate(template, snapshot, summary, state)]));
}

function topKey(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const overload = scoresFor({ calendarDay: 8, heat: 85, reputation: 70, staff: 1, markets: { whale: true, frog: true, cbd: false } });
const highRisk = scoresFor({ calendarDay: 10, risk: 80, documents: 22, conscience: 34, paidTraffic: 40, policy: "hype", source: "frozenDuck" });
const thinMargin = scoresFor({ calendarDay: 12, cash: 80, price: 18, policy: "balanced", source: "freshDuck", heat: 24, reputation: 45 });

assert(topKey(overload) === "staff-fatigue", "overload state should prefer staff fatigue event");
assert(topKey(highRisk) === "platform-check", "high risk state should prefer platform check event");
assert(topKey(thinMargin) === "supplier-price", "thin margin state should prefer supplier price event");

console.log(JSON.stringify({ overload, highRisk, thinMargin }, null, 2));
