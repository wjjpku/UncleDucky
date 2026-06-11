import { survivalDays } from "../src/config.js";
import { simulateAll } from "./simulation.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = Object.fromEntries(simulateAll().map(({ name, final, outcome }) => [name, { ...final, outcome }]));

assert(results.baseline.outcome === "survived" && results.baseline.day === survivalDays, `baseline should survive ${survivalDays} days`);
assert(results.careful.outcome === "survived" && results.careful.day === survivalDays, `careful should survive ${survivalDays} days`);
assert(results.aggressive.outcome === "survived" && results.aggressive.day === survivalDays, `aggressive should survive ${survivalDays} days but carry high risk`);
assert(results.careful.risk < results.baseline.risk, "careful route should reduce risk versus baseline");
assert(results.aggressive.cash > results.baseline.cash, "aggressive route should earn more cash than baseline");
assert(results.aggressive.risk > results.careful.risk + 15, "aggressive route should carry a clear risk premium");
assert(results.baseline.risk >= 35 && results.baseline.risk <= 65, "baseline risk should end in a moderate playable range");

console.log(JSON.stringify(results, null, 2));
