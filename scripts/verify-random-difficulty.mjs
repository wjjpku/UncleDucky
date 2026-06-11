import { readFileSync } from "node:fs";
import { initialState, operatingModel, policyOptions, sourceOptions, survivalDays } from "../src/config.js";
import { operatingSnapshot } from "../src/economy.js";
import { isRiskFailure, isStableSuccess } from "../src/successCriteria.js";
import { clamp } from "../src/utils.js";

const RANDOM_RUNS = 1200;
const MAX_RANDOM_SUCCESS_RATE = 0.05;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mulberry32(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choice(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function metricSummary(state) {
  return {
    bank: Math.max(0, Math.round(state.cash)),
    risk: clamp(Math.round(state.risk * 0.55 + (100 - state.documents) * 0.3 + (100 - state.conscience) * 0.15)),
    traffic: clamp(Math.round(state.heat * 0.45 + state.reputation * 0.3 + state.paidTraffic * 0.25)),
    documents: Math.round(state.documents),
  };
}

function parseEffectPool() {
  const source = readFileSync(new URL("../game.js", import.meta.url), "utf8");
  const effects = [];
  const pattern = /\beffects:\s*\{([^}]+)\}/g;
  let match;

  while ((match = pattern.exec(source))) {
    const body = match[1].trim();
    try {
      const effect = Function(`"use strict"; return ({${body}});`)();
      if (Object.values(effect).some((value) => typeof value === "number")) effects.push(effect);
    } catch {
      // Skip non-literal effect blocks.
    }
  }

  assert(effects.length >= 60, `expected enough narrative effects, got ${effects.length}`);
  return effects;
}

function applyEffects(state, effects) {
  Object.entries(effects).forEach(([key, delta]) => {
    if (typeof state[key] !== "number") return;
    const adjusted = key === "risk" && delta > 0 ? delta * 0.7 : delta;
    state[key] = key === "cash" ? Math.max(0, state[key] + adjusted) : clamp(state[key] + adjusted);
  });
}

function applyDailyState(state, snapshot) {
  state.cash = Math.max(0, state.cash + snapshot.dailyGrossProfit);
  state.heat = clamp(state.heat + snapshot.dailyHeat);
  state.risk = clamp(state.risk + snapshot.dailyRisk);
  state.reputation = clamp(state.reputation + snapshot.dailyReputation);
  state.documents = clamp(state.documents + snapshot.dailyDocuments);
  state.conscience = clamp(state.conscience + snapshot.dailyConscience);
  state.paidTraffic = clamp(state.paidTraffic - 18, 0, 100);
}

function randomBusinessActions(state, rng, day) {
  state.policy = choice(rng, Object.keys(policyOptions));
  state.source = choice(rng, Object.keys(sourceOptions));
  const source = sourceOptions[state.source];
  const priceFloor = Math.max(8, Math.round(source.referencePrice * 0.65));
  const priceCeiling = Math.min(100, Math.round(source.referencePrice * 3));
  state.price = Math.round(priceFloor + rng() * (priceCeiling - priceFloor));
  state.productFocus = state.source === "goose" ? "goose" : state.source === "freshDuck" ? "duck" : "cheapDuck";

  if (rng() < 0.28 && state.cash >= operatingModel.reputationCost) {
    state.cash -= operatingModel.reputationCost;
    state.reputation = clamp(state.reputation + 7);
    state.documents = clamp(state.documents + 2);
  }

  if (rng() < 0.34 && state.cash >= operatingModel.trafficCost) {
    state.cash -= operatingModel.trafficCost;
    state.paidTraffic = clamp(state.paidTraffic + operatingModel.trafficBoost);
    state.heat = clamp(state.heat + 5);
    state.risk = clamp(state.risk + 1);
  }

  if (rng() < 0.3 && state.staff < 4 && state.cash >= operatingModel.staffHiringCost) {
    state.cash -= operatingModel.staffHiringCost;
    state.staff += 1;
  }

  if (rng() < 0.18 && state.staff > 1) state.staff -= 1;
  if (day >= 4 && rng() < 0.22 && state.staff >= 2 && state.cash >= 80) {
    state.cash -= 80;
    state.markets.frog = true;
  }
  if (day >= 7 && rng() < 0.18 && state.staff >= 3 && state.cash >= 180) {
    state.cash -= 180;
    state.markets.cbd = true;
  }
}

function randomRun(seed, effectPool) {
  const rng = mulberry32(seed);
  const state = structuredClone(initialState);
  const failures = [];

  for (let day = 1; day <= survivalDays; day += 1) {
    state.calendarDay = day;
    randomBusinessActions(state, rng, day);

    const choicesToday = day < 9 ? 1 : 2;
    for (let i = 0; i < choicesToday; i += 1) {
      applyEffects(state, choice(rng, effectPool));
    }

    applyDailyState(state, operatingSnapshot(state));
    const summary = metricSummary(state);
    if (summary.bank <= 0) failures.push("bankrupt");
    if (isRiskFailure(summary)) failures.push("risk");
    if (failures.length) return { success: false, day, reason: failures[0], summary };
  }

  const summary = metricSummary(state);
  const success = isStableSuccess(state, summary);
  return { success, day: survivalDays, reason: success ? "success" : "unstable", summary };
}

const effectPool = parseEffectPool();
const outcomes = Array.from({ length: RANDOM_RUNS }, (_, index) => randomRun(index + 1, effectPool));
const successes = outcomes.filter((item) => item.success);
const successRate = successes.length / outcomes.length;
const reasons = outcomes.reduce((map, item) => {
  map[item.reason] = (map[item.reason] || 0) + 1;
  return map;
}, {});

assert(successRate < MAX_RANDOM_SUCCESS_RATE, `random success rate ${(successRate * 100).toFixed(2)}% should be below 5%`);

console.log(JSON.stringify({
  runs: RANDOM_RUNS,
  successRate: Number(successRate.toFixed(4)),
  successes: successes.length,
  reasons,
  sampleSuccesses: successes.slice(0, 5),
}, null, 2));
