import { initialState, marketOptions, operatingModel, priceBounds, sourceOptions, survivalDays, universityMarketKeys } from "../src/config.js";
import { availableStaffForMarket, operatingSnapshot } from "../src/economy.js";
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
    hireUntil: 6,
    expandCampusAt: 450,
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

export function bestPriceForState(state) {
  let best = null;
  for (let price = priceBounds.min; price <= priceBounds.max; price += 1) {
    const snapshot = operatingSnapshot({ ...state, price });
    const candidate = { price, snapshot };
    if (
      !best ||
      snapshot.dailyGrossProfit > best.snapshot.dailyGrossProfit ||
      (snapshot.dailyGrossProfit === best.snapshot.dailyGrossProfit && snapshot.dailyRisk < best.snapshot.dailyRisk) ||
      (snapshot.dailyGrossProfit === best.snapshot.dailyGrossProfit &&
        snapshot.dailyRisk === best.snapshot.dailyRisk &&
        price < best.price)
    ) {
      best = candidate;
    }
  }
  return best;
}

function canOpenMarket(state, key) {
  const market = marketOptions[key];
  const traffic = metricSummary(state).traffic;
  const cost = key === "cbd" ? market.unlockCost : market.contactCost;
  return availableStaffForMarket(state, key) >= market.requiredStaff && traffic >= market.requiredTraffic && state.cash >= cost;
}

function universityTargets(state, strategy) {
  const homeName = state.homeSchoolName || initialState.homeSchoolName;
  const configured = strategy.selectedUniversityMarkets || state.selectedUniversityMarkets || [];
  const fallback = universityMarketKeys.filter((key) => marketOptions[key]?.label !== homeName);
  return [...configured, ...fallback]
    .filter((key, index, list) => universityMarketKeys.includes(key) && marketOptions[key]?.label !== homeName && list.indexOf(key) === index)
    .slice(0, 2);
}

function openUniversityMarketForSimulation(state, key) {
  if (!canOpenMarket(state, key)) return false;
  state.cash -= marketOptions[key].contactCost;
  state.markets[key] = true;
  return true;
}

function openCbdForSimulation(state) {
  const option = marketOptions.cbd;
  const fullCost = option.contactCost + option.unlockCost;
  if (
    state.markets.cbd ||
    availableStaffForMarket(state, "cbd") < option.requiredStaff ||
    metricSummary(state).traffic < option.requiredTraffic ||
    state.cash < fullCost
  ) {
    return false;
  }
  state.cash -= fullCost;
  state.markets.cbd = true;
  return true;
}

function applyStrategyActions(state, strategy, day) {
  if (strategy.optimizePrice === false) state.price = strategy.price;
  state.policy = strategy.policy;
  state.source = strategy.source;
  if (strategy.selectedUniversityMarkets) state.selectedUniversityMarkets = universityTargets(state, strategy);

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

  if (strategy.hireAtCash && state.staff < (strategy.hireUntil || 3) && state.cash >= strategy.hireAtCash) {
    state.cash -= operatingModel.staffHiringCost;
    state.staff += 1;
  }

  if (strategy.expandCampusAt && state.cash >= strategy.expandCampusAt) {
    const targetCount = strategy.expandCampusCount || 1;
    const targets = universityTargets(state, strategy);
    let openedCount = targets.filter((key) => state.markets[key]).length;
    for (const key of targets) {
      if (openedCount >= targetCount) break;
      if (state.markets[key]) continue;
      if (openUniversityMarketForSimulation(state, key)) openedCount += 1;
    }
  }

  if (strategy.expandCbdAt && state.cash >= strategy.expandCbdAt) {
    openCbdForSimulation(state);
  }
}

export function simulate(name, strategy) {
  const state = structuredClone(initialState);
  const rows = [];
  let outcome = "survived";

  for (let day = 1; day <= survivalDays; day += 1) {
    state.calendarDay = day;
    applyStrategyActions(state, strategy, day);
    const optimal = strategy.optimizePrice === false ? null : bestPriceForState(state);
    if (optimal) state.price = optimal.price;
    const snapshot = operatingSnapshot(state);
    applyDailyState(state, snapshot);
    const summary = metricSummary(state);
    rows.push({
      day,
      cash: summary.bank,
      risk: summary.risk,
      traffic: summary.traffic,
      price: state.price,
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
