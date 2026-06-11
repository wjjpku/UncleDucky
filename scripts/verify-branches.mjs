import { initialState } from "../src/config.js";
import { selectStoryId, storyReasonForItem } from "../src/storyEngine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function summaryFor(state) {
  return {
    bank: Math.max(0, Math.round(state.cash)),
    risk: Math.max(
      0,
      Math.min(100, Math.round(state.risk * 0.55 + (100 - state.documents) * 0.3 + (100 - state.conscience) * 0.15)),
    ),
    traffic: Math.max(0, Math.min(100, Math.round(state.heat * 0.45 + state.reputation * 0.3 + state.paidTraffic * 0.25))),
  };
}

function branchFor(state) {
  return selectStoryId(state, summaryFor(state));
}

function makeState(patch = {}) {
  const state = structuredClone(initialState);
  Object.assign(state, patch);
  state.flags = { ...initialState.flags, ...(patch.flags || {}) };
  state.markets = { ...initialState.markets, ...(patch.markets || {}) };
  state.completed = { ...(patch.completed || {}) };
  state.requests = { ...(patch.requests || {}) };
  return state;
}

const quiet = makeState({ calendarDay: 6, cash: 150, reputation: 50, heat: 30 });
assert(branchFor(quiet) === "frog-campus", "quiet midgame should favor campus expansion");

const hot = makeState({ calendarDay: 6, reputation: 70 });
assert(branchFor(hot) === "media-dm", "trusted stall should trigger interview");

const risky = makeState({
  calendarDay: 9,
  source: "frozenDuck",
  flags: { shadyStock: true },
});
assert(branchFor(risky) === "green", "risky supply should trigger food safety issue");

const clean = makeState({
  calendarDay: 9,
  source: "freshDuck",
  flags: { clearLabel: true },
});
assert(branchFor(clean) === "name-drift", "clear menu should delay crisis into naming pressure");

const ama = makeState({
  calendarDay: 11,
  heat: 70,
  completed: { "orange-book-ama": true },
});
assert(branchFor(ama) === "ama-overflow", "accepted hot AMA should create AMA follow-up");

const honestAma = makeState({
  calendarDay: 11,
  source: "freshDuck",
  documents: 70,
  risk: 12,
  flags: { clearLabel: true },
  completed: { "orange-book-ama": true },
});
assert(branchFor(honestAma) === "supplier-good-bad-duck", "honest AMA route should become supply pressure, not a complaint");

const honestBusiness = makeState({
  calendarDay: 12,
  source: "freshDuck",
  documents: 72,
  risk: 10,
  flags: { clearLabel: true },
  completed: { "business-district": true },
});
assert(branchFor(honestBusiness) === "final-supplier", "honest business district should become fulfillment pressure, not a district report");

const riskyBusiness = makeState({
  calendarDay: 12,
  source: "frozenDuck",
  flags: { shadyStock: true },
  completed: { "business-district": true },
});
assert(branchFor(riskyBusiness) === "cbd-report", "risky business district should create district follow-up");

const rejectedFrog = makeState({
  calendarDay: 6,
  requests: { "frog-campus": "rejected" },
});
assert(branchFor(rejectedFrog) !== "frog-campus", "rejected friend request should not be offered again as the same request");

const acceptedFrog = makeState({
  calendarDay: 6,
  requests: { "frog-campus": "accepted" },
});
assert(branchFor(acceptedFrog) === "frog-campus", "accepted request should remain available until the formal chat is answered");

const reason = storyReasonForItem(honestBusiness, summaryFor(honestBusiness), { id: "final-supplier" });
assert(reason.includes("诚信经营线"), "honest late route should explain fulfillment pressure");

console.log(JSON.stringify({
  quiet: branchFor(quiet),
  hot: branchFor(hot),
  risky: branchFor(risky),
  clean: branchFor(clean),
  ama: branchFor(ama),
  honestAma: branchFor(honestAma),
  honestBusiness: branchFor(honestBusiness),
  riskyBusiness: branchFor(riskyBusiness),
  rejectedFrog: branchFor(rejectedFrog),
  acceptedFrog: branchFor(acceptedFrog),
  reason,
}, null, 2));
