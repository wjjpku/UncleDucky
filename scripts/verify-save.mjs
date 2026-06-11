import { initialState } from "../src/config.js";
import { mergeSavedState, parseSavedGame, saveKey, saveVersion } from "../src/save.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const partial = mergeSavedState(initialState, {
  started: true,
  calendarDay: 5,
  speed: 2,
  stallOpenedDay: 5,
  stallOpenedMinute: 612,
  cash: 777,
  markets: { frog: true },
  manualCampusRequests: { deer: "pending" },
  selectedUniversityMarkets: ["deer", "lion"],
  effectQueue: [{ remaining: 90, effects: { heat: 12, risk: 2 } }],
  incomeMultiplier: 0.72,
  incomeMultiplierUntilDay: 4,
  incomeMultiplierReason: "限量出摊",
  supplyHistory: [
    { day: 2, source: "freshDuck", reason: "实际出摊", price: 28, markets: 1, sales: 32 },
    { day: 4, source: "goose", reason: "供应商确认", price: 39, markets: 1, sales: 12 },
  ],
  routes: { hype: 3 },
  flags: { clearLabel: true },
  dailyIncidentKeys: { 5: "staff-fatigue" },
  dayReports: [{ day: 1, cashDelta: 200, operatedRatio: 75 }],
});

assert(partial.calendarDay === 5, "saved calendar day should be preserved");
assert(partial.speed === 2 && partial.stallOpenedDay === 5 && partial.stallOpenedMinute === 612, "speed and daily stall state should restore");
assert(partial.markets.whale === true && partial.markets.frog === true && partial.markets.cbd === false, "market defaults should merge");
assert(partial.manualCampusRequests.deer === "pending", "manual campus request state should restore");
assert(partial.selectedUniversityMarkets.join(",") === "deer,lion", "selected university candidates should restore");
assert(partial.effectQueue[0]?.remaining === 90 && partial.effectQueue[0]?.effects?.heat === 12, "gradual effect queue should restore");
assert(partial.incomeMultiplier === 0.72 && partial.incomeMultiplierUntilDay === 4, "temporary income multiplier should restore");
assert(partial.supplyHistory.length === 2 && partial.supplyHistory[1].source === "goose", "supply history should restore valid source usage");
assert(partial.routes.hype === 3 && partial.routes.compliance === 0, "route defaults should merge");
assert(partial.flags.clearLabel === true && partial.flags.invoice === false, "flag defaults should merge");
assert(partial.dailyIncidentKeys[5] === "staff-fatigue", "daily incident locks should restore");
assert(partial.dayReports.length === 1, "array fields should restore when valid");

const malformed = mergeSavedState(initialState, {
  started: true,
  calendarDay: 999,
  minute: "bad",
  speed: 9,
  stallOpenedDay: 999,
  stallOpenedMinute: 99999,
  cash: "bad",
  risk: 999,
  documents: -20,
  price: "bad",
  policy: "free-money",
  source: "mystery",
  productFocus: "unknown",
  staff: 99,
  incomeMultiplier: 9,
  incomeMultiplierUntilDay: 999,
  incomeMultiplierReason: 12,
  supplyHistory: [{ day: 100, source: "mystery" }, { day: 3, source: "freshDuck", price: 500, markets: 99, sales: "bad" }],
  activeMainTab: "stats",
  markets: "frog",
  marketContacts: ["bad"],
  selectedUniversityMarkets: { 0: "frog" },
  routes: "hype",
  flags: null,
  chatHistory: ["bad"],
  knownChats: "bad",
  chatOrder: { 0: "bad" },
  effectQueue: { remaining: 20 },
});
assert(malformed.markets.whale === true && malformed.markets.frog === false, "malformed market object should fall back to defaults");
assert(malformed.marketContacts.frog === "locked", "malformed market contacts should fall back to defaults");
assert(malformed.calendarDay === 15 && malformed.minute === initialState.minute, "malformed day and minute should be clamped or restored");
assert(malformed.speed === initialState.speed && malformed.cash === initialState.cash, "malformed speed and cash should fall back safely");
assert(malformed.stallOpenedDay === 15 && malformed.stallOpenedMinute === 1260, "stall state should be clamped to the playable day range");
assert(malformed.risk === 100 && malformed.documents === 0, "out-of-range metrics should be clamped");
assert(malformed.price === initialState.price && malformed.policy === initialState.policy && malformed.source === initialState.source, "malformed operating choices should fall back");
assert(malformed.staff === 6 && malformed.activeMainTab === initialState.activeMainTab, "out-of-range staff and tab should be normalized");
assert(malformed.incomeMultiplier === 1 && malformed.incomeMultiplierUntilDay === 15 && malformed.incomeMultiplierReason === "", "income multiplier fields should be normalized");
assert(
  malformed.supplyHistory.length === 1 &&
    malformed.supplyHistory[0].source === "freshDuck" &&
    malformed.supplyHistory[0].price === 100 &&
    malformed.supplyHistory[0].markets === 5,
  "supply history should drop invalid entries and clamp numeric fields",
);
assert(Array.isArray(malformed.selectedUniversityMarkets) && malformed.selectedUniversityMarkets.length === 0, "malformed university array should be ignored");
assert(malformed.routes.compliance === 0 && malformed.flags.invoice === false, "malformed route and flag objects should fall back to defaults");
assert(Object.keys(malformed.chatHistory).length === 0 && Object.keys(malformed.knownChats).length === 0, "malformed chat objects should be ignored");
assert(Array.isArray(malformed.chatOrder) && malformed.chatOrder.length === 0, "malformed chat order should be ignored");
assert(Array.isArray(malformed.effectQueue) && malformed.effectQueue.length === 0, "malformed effect queue should be ignored");

const nestedMalformed = mergeSavedState(initialState, {
  started: true,
  manualCampusRequests: { frog: "completed", whale: "pending", deer: "weird" },
  routes: { compliance: 2, hype: "bad", ghost: 4 },
  flags: { clearLabel: true, invoice: "yes", ghost: false },
  requests: { "campus-invite-1": "accepted", bad: "maybe" },
  effectQueue: [
    { remaining: "bad", effects: null },
    { remaining: 30, effects: { heat: "bad", risk: 2 } },
  ],
  chatHistory: {
    A: "bad",
    B: [
      { who: 1, text: null },
      { who: "我", text: "ok" },
    ],
  },
  knownChats: {
    B: { unread: "bad", last: 1, kind: "bad" },
    C: { unread: "3", last: "三条", kind: "request" },
    D: { unread: "已拒绝", last: "拒绝", kind: "request" },
  },
  chatOrder: ["B", 1, "C"],
  dayReports: [
    { day: "bad" },
    { day: 2, cashDelta: "x", sales: 5, risk: 200, traffic: -1, suspended: "no", operatedRatio: 140 },
  ],
});
assert(nestedMalformed.manualCampusRequests.frog === "completed" && !nestedMalformed.manualCampusRequests.deer, "manual campus request entries should be filtered by key and status");
assert(nestedMalformed.routes.compliance === 2 && nestedMalformed.routes.hype === 0 && nestedMalformed.routes.ghost === 4, "route scores should keep only numeric values");
assert(nestedMalformed.flags.clearLabel === true && nestedMalformed.flags.invoice === false && nestedMalformed.flags.ghost === false, "flags should keep only booleans");
assert(nestedMalformed.requests["campus-invite-1"] === "accepted" && !nestedMalformed.requests.bad, "request statuses should be filtered");
assert(nestedMalformed.effectQueue.length === 1 && nestedMalformed.effectQueue[0].effects.risk === 2 && !("heat" in nestedMalformed.effectQueue[0].effects), "effect queue should drop invalid entries and deltas");
assert(nestedMalformed.chatHistory.B.length === 1 && nestedMalformed.chatHistory.B[0].text === "ok", "chat history should keep valid messages only");
assert(nestedMalformed.knownChats.B.unread === 0 && nestedMalformed.knownChats.C.unread === 3 && nestedMalformed.knownChats.D.unread === "已拒绝", "chat unread state should normalize to exact counts or rejected status");
assert(nestedMalformed.chatOrder.join(",") === "B,C", "chat order should keep string titles only");
assert(
  nestedMalformed.dayReports.length === 1 &&
    nestedMalformed.dayReports[0].risk === 100 &&
    nestedMalformed.dayReports[0].traffic === 0 &&
    nestedMalformed.dayReports[0].operatedRatio === 100,
  "day reports should clamp nested values",
);

const validRaw = JSON.stringify({ version: saveVersion, savedAt: 1, state: partial });
const parsed = parseSavedGame(validRaw, initialState);
assert(parsed?.state?.cash === 777, "valid save should parse");

const endedRaw = JSON.stringify({ version: saveVersion, savedAt: 1, state: { ...partial, ended: true } });
assert(parseSavedGame(endedRaw, initialState) === null, "ended save should not show continue entry");

const oldRaw = JSON.stringify({ version: saveVersion - 1, savedAt: 1, state: partial });
assert(parseSavedGame(oldRaw, initialState) === null, "old save version should be ignored");

const stringStartedRaw = JSON.stringify({ version: saveVersion, savedAt: 1, state: { ...partial, started: "true" } });
assert(parseSavedGame(stringStartedRaw, initialState) === null, "non-boolean started save should be ignored after normalization");

assert(saveKey === "duckyStudentsSave:v2", "save key should stay stable for current save version");

console.log(JSON.stringify({ parsedDay: parsed.state.calendarDay, parsedCash: Math.round(parsed.state.cash), saveKey }, null, 2));
