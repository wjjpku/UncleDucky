import { initialState, marketOptions, operatingModel, sourceOptions, survivalDays } from "../src/config.js";
import { operatingSnapshot } from "../src/economy.js";
import { isRiskFailure } from "../src/successCriteria.js";
import { clamp } from "../src/utils.js";

export const strategies = {
  baseline: {
    price: 22,
    policy: "balanced",
    source: "freshDuck",
  },
  careful: {
    price: 25,
    policy: "transparent",
    source: "freshDuck",
    improveEvery: 5,
  },
  aggressive: {
    price: 20,
    policy: "hype",
    source: "frozenDuck",
    buyTrafficEvery: 4,
    hireAtCash: 500,
    expandFrogAt: 450,
    expandCbdAt: 1100,
  },
  premium: {
    price: 36,
    policy: "transparent",
    source: "goose",
    improveEvery: 4,
  },
};

export function metricSummary(state) {
  return {
    bank: Math.max(0, Math.round(state.cash)),
    risk: clamp(Math.round(state.risk * 0.55 + (100 - state.documents) * 0.3 + (100 - state.conscience) * 0.15)),
    traffic: clamp(Math.round(state.heat * 0.45 + state.reputation * 0.3 + state.paidTraffic * 0.25)),
  };
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

function canOpenMarket(state, key) {
  const market = marketOptions[key];
  const traffic = metricSummary(state).traffic;
  return state.staff >= market.requiredStaff && traffic >= market.requiredTraffic && state.cash >= market.unlockCost;
}

function applyStrategyActions(state, strategy, day) {
  state.price = strategy.price;
  state.policy = strategy.policy;
  state.source = strategy.source;

  if (strategy.improveEvery && day % strategy.improveEvery === 0 && state.cash >= operatingModel.reputationCost) {
    state.cash -= operatingModel.reputationCost;
    state.reputation = clamp(state.reputation + 5);
    state.documents = clamp(state.documents + 2);
    state.heat = clamp(state.heat - 1);
  }

  if (strategy.buyTrafficEvery && day % strategy.buyTrafficEvery === 0 && state.cash >= operatingModel.trafficCost) {
    state.cash -= operatingModel.trafficCost;
    state.paidTraffic = clamp(state.paidTraffic + operatingModel.trafficBoost);
    state.heat = clamp(state.heat + 3);
    state.risk = clamp(state.risk + 0.6);
  }

  if (strategy.hireAtCash && state.staff < 3 && state.cash >= strategy.hireAtCash) {
    state.cash -= operatingModel.staffHiringCost;
    state.staff += 1;
  }

  if (strategy.expandFrogAt && !state.markets.frog && state.cash >= strategy.expandFrogAt && canOpenMarket(state, "frog")) {
    state.cash -= marketOptions.frog.unlockCost;
    state.markets.frog = true;
  }

  if (strategy.expandCbdAt && !state.markets.cbd && state.cash >= strategy.expandCbdAt && canOpenMarket(state, "cbd")) {
    state.cash -= marketOptions.cbd.unlockCost;
    state.markets.cbd = true;
  }
}

export function simulate(name, strategy) {
  const state = structuredClone(initialState);
  const rows = [];
  let outcome = "survived";

  for (let day = 1; day <= survivalDays; day += 1) {
    state.calendarDay = day;
    applyStrategyActions(state, strategy, day);
    const snapshot = operatingSnapshot(state);
    applyDailyState(state, snapshot);
    const summary = metricSummary(state);
    rows.push({
      day,
      cash: summary.bank,
      risk: summary.risk,
      traffic: summary.traffic,
      documents: Math.round(state.documents),
      profit: Math.round(snapshot.dailyGrossProfit),
      sales: Math.round(snapshot.dailySales),
      staff: state.staff,
      markets: Object.entries(state.markets)
        .filter(([, active]) => active)
        .map(([key]) => key)
        .join("+"),
      source: sourceOptions[state.source].label,
    });

    if (summary.bank <= 0) {
      outcome = "bankrupt";
      break;
    }
    if (isRiskFailure(summary)) {
      outcome = "risk";
      break;
    }
  }

  return {
    name,
    outcome,
    rows,
    final: rows.at(-1),
    checkpoints: rows.filter((row) => [1, 5, 10, 15].includes(row.day)),
  };
}

export function simulateAll(selectedStrategies = strategies) {
  return Object.entries(selectedStrategies).map(([name, strategy]) => simulate(name, strategy));
}
