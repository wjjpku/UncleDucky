import { initialState, policyOptions, priceBounds, survivalDays } from "../src/config.js";
import { operatingSnapshot } from "../src/economy.js";
import { bestPriceForState, simulate, simulateAll, strategies } from "./simulation.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = Object.fromEntries(simulateAll().map(({ name, final, outcome }) => [name, { ...final, outcome }]));

assert(results.baseline.outcome === "survived" && results.baseline.day === survivalDays, `baseline should survive ${survivalDays} days`);
assert(results.careful.outcome === "survived" && results.careful.day === survivalDays, `careful should survive ${survivalDays} days`);
assert(results.aggressive.outcome === "survived" && results.aggressive.day === survivalDays, `aggressive should survive ${survivalDays} days but carry high risk`);
assert(results.careful.risk < results.baseline.risk, "careful route should reduce risk versus baseline");
assert(results.careful.cash < results.baseline.cash, "limited outing should earn less than normal outing at the optimal simulated price");
assert(results.careful.profit < results.baseline.profit, "limited outing should lower daily profit versus normal outing");
assert(results.aggressive.cash > results.baseline.cash, "aggressive route should earn more cash than baseline");
assert(results.aggressive.risk > results.careful.risk + 15, "aggressive route should carry a clear risk premium");
assert(results.aggressive.staff >= 6 && results.aggressive.markets.includes("cbd"), "business district expansion should require separately hired staff");
assert(results.baseline.risk >= 55 && results.baseline.risk <= 80, "profit-maximized baseline should carry visible price and label risk");
assert(results.baseline.price > strategies.baseline.price, "simulation should optimize baseline price instead of using the static default");
assert(results.premium.outcome === "bankrupt", "true-goose limited route should be unaffordable even at the optimal simulated price");
const visiblePolicyLabels = Object.values(policyOptions).map((option) => option.label);
assert(
  visiblePolicyLabels.join("|") === "限量出摊|正常出摊|加量出摊",
  "visible policy options should stay player-directed outing intensity controls",
);

const optimalStart = bestPriceForState({ ...structuredClone(initialState), started: true, policy: "transparent", source: "freshDuck" });
const normalStart = bestPriceForState({ ...structuredClone(initialState), started: true, policy: "balanced", source: "freshDuck" });
assert(optimalStart.price > strategies.careful.price, "optimal price search should account for player-controlled pricing");
assert(optimalStart.snapshot.dailyGrossProfit < normalStart.snapshot.dailyGrossProfit, "limited outing should reduce daily profit versus normal outing");

const freeSample = operatingSnapshot({ ...structuredClone(initialState), started: true, price: priceBounds.min });
assert(freeSample.dailySales > 0, "zero price should still attract buyers");
assert(freeSample.dailyGrossProfit < 0, "zero price should lose money instead of becoming a free growth exploit");

const premiumSample = operatingSnapshot({ ...structuredClone(initialState), started: true, price: priceBounds.max });
assert(premiumSample.dailySales === 0, "price 100 should crush demand");
assert(premiumSample.priceRisk > 0, "very high price should create price-risk pressure");

const nonFrogCampus = simulate("nonFrogCampus", {
  ...strategies.aggressive,
  selectedUniversityMarkets: ["deer", "lion"],
  expandCbdAt: 0,
}).final;
assert(nonFrogCampus.markets.includes("deer"), "dynamic campus simulation should open the selected non-frog university");
assert(!nonFrogCampus.markets.includes("frog"), "dynamic campus simulation should not hard-code frog university");

console.log(JSON.stringify(results, null, 2));
