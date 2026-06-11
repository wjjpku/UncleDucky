import { initialState } from "../src/config.js";
import { mergeSavedState, parseSavedGame, saveKey, saveVersion } from "../src/save.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const partial = mergeSavedState(initialState, {
  started: true,
  calendarDay: 5,
  cash: 777,
  markets: { frog: true },
  routes: { hype: 3 },
  flags: { clearLabel: true },
  dailyIncidentKeys: { 5: "staff-fatigue" },
  dayReports: [{ day: 1, cashDelta: 200 }],
});

assert(partial.calendarDay === 5, "saved calendar day should be preserved");
assert(partial.markets.whale === true && partial.markets.frog === true && partial.markets.cbd === false, "market defaults should merge");
assert(partial.routes.hype === 3 && partial.routes.compliance === 0, "route defaults should merge");
assert(partial.flags.clearLabel === true && partial.flags.invoice === false, "flag defaults should merge");
assert(partial.dailyIncidentKeys[5] === "staff-fatigue", "daily incident locks should restore");
assert(partial.dayReports.length === 1, "array fields should restore when valid");

const validRaw = JSON.stringify({ version: saveVersion, savedAt: 1, state: partial });
const parsed = parseSavedGame(validRaw, initialState);
assert(parsed?.state?.cash === 777, "valid save should parse");

const endedRaw = JSON.stringify({ version: saveVersion, savedAt: 1, state: { ...partial, ended: true } });
assert(parseSavedGame(endedRaw, initialState) === null, "ended save should not show continue entry");

const oldRaw = JSON.stringify({ version: saveVersion - 1, savedAt: 1, state: partial });
assert(parseSavedGame(oldRaw, initialState) === null, "old save version should be ignored");

assert(saveKey === "duckyStudentsSave:v2", "save key should stay stable for current save version");

console.log(JSON.stringify({ parsedDay: parsed.state.calendarDay, parsedCash: Math.round(parsed.state.cash), saveKey }, null, 2));
