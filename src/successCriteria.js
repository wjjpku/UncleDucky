import { operatingSnapshot } from "./economy.js";

export function requiredCashReserve(state) {
  const snapshot = operatingSnapshot(state);
  const fixedPressure = snapshot.dailyWages + snapshot.logisticsCost + snapshot.challengeCost;
  return Math.max(240, Math.round(fixedPressure * 3));
}

export function isStableSuccess(state, summary) {
  const documents = Math.round(state.documents ?? summary.documents ?? 0);
  const reserve = requiredCashReserve(state);
  const stableBusiness = summary.bank >= reserve && summary.risk < 55 && summary.traffic >= 35 && documents >= 55;
  const leanCompliance = summary.bank >= reserve * 0.65 && summary.risk < 45 && summary.traffic >= 25 && documents >= 65;
  return stableBusiness || leanCompliance;
}

export function isRiskFailure(summary) {
  return summary.risk >= 100;
}
