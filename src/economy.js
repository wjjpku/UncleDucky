import { clamp } from "./utils.js";
import { marketOptions, operatingModel, policyOptions, sourceOptions } from "./config.js";

export function activeMarketEntries(state) {
  return Object.entries(marketOptions).filter(([key]) => {
    const suspendedUntil = state.marketSuspensions?.[key] || 0;
    return state.markets[key] && suspendedUntil < state.calendarDay;
  });
}

function trafficScore(state) {
  return clamp(Math.round(state.heat * 0.55 + state.reputation * 0.35 + state.paidTraffic * 0.1));
}

function stagePressure(state) {
  const mid = state.calendarDay >= operatingModel.challengeStartDay;
  const late = state.calendarDay >= operatingModel.lateChallengeDay;
  const day = state.calendarDay;
  return {
    stage: late ? "late" : mid ? "mid" : "early",
    cost: mid ? (day - operatingModel.challengeStartDay + 1) * operatingModel.challengeCostPerDay : 0,
    lateCost: late ? (day - operatingModel.lateChallengeDay + 1) * operatingModel.lateChallengeCostPerDay : 0,
    risk: mid ? (day - operatingModel.challengeStartDay + 1) * operatingModel.challengeRiskPerDay : 0,
    lateRisk: late ? (day - operatingModel.lateChallengeDay + 1) * operatingModel.lateChallengeRiskPerDay : 0,
    compliance: mid ? (day - operatingModel.challengeStartDay + 1) * operatingModel.challengeCompliancePerDay : 0,
  };
}

export function priceDemandFactor(state, source) {
  const ratio = state.price / source.referencePrice;
  if (ratio <= 1) {
    return clamp(1 + (1 - ratio) * source.priceElasticity * 0.35, 1, 1.55);
  }
  return clamp(1 - (ratio - 1) * source.priceElasticity * 0.45, 0, 1);
}

export function priceRiskPressure(state, source) {
  const gap = state.price - source.referencePrice;
  if (gap <= 2) return 0;
  const visibleGap = Math.max(0, gap - 2);
  return Math.min(34, visibleGap * 0.55 + Math.max(0, visibleGap - 18) * 0.45);
}

export function operatingSnapshot(state) {
  const policy = policyOptions[state.policy];
  const source = sourceOptions[state.source];
  const markets = activeMarketEntries(state);
  const suspended = (state.suspendedUntilDay || 0) >= state.calendarDay;
  const pressure = stagePressure(state);
  const marketCount = markets.length;
  const extraMarketCount = Math.max(0, marketCount - 1);
  const traffic = trafficScore(state);
  const baseDemand = markets.reduce((sum, [, market]) => sum + market.dailyDemand, 0);
  const demand =
    baseDemand *
    priceDemandFactor(state, source) *
    policy.demandMultiplier *
    clamp(0.65 + traffic / 120, 0.65, 1.35);
  const capacity = state.staff * operatingModel.staffCapacityPerDay * (policy.capacityPerDay / 95) * source.supplyReliability;
  const sales = suspended ? 0 : Math.min(demand, capacity);
  const unitMargin = state.price - source.unitCost - policy.operatingCost;
  const priceRisk = suspended ? 0 : priceRiskPressure(state, source);
  const wages = state.staff * operatingModel.staffDailyWage;
  const logistics =
    marketCount * operatingModel.baseLogisticsCost +
    extraMarketCount * operatingModel.extraMarketLogisticsCost +
    Math.max(0, state.staff - 1) * operatingModel.extraStaffManagementCost;
  const sourceFixedCost = (source.fixedCost || 0) + extraMarketCount * (source.extraMarketCost || 0);
  const challengeCost = pressure.cost + pressure.lateCost + extraMarketCount * 12 + sourceFixedCost;
  const dailyGrossProfit = suspended
    ? -Math.round(wages * operatingModel.suspensionWageRate + challengeCost * 0.3)
    : Math.round(sales * unitMargin - wages - logistics - challengeCost);
  const overloadRatio = capacity ? Math.max(0, demand - capacity) / capacity : 0;
  const complianceCoverage = clamp(policy.paperworkDiscipline * 0.45 + policy.clarity * 0.35 + source.documentFit * 0.2, 0, 1);
  const complianceNeed = clamp(0.32 + extraMarketCount * 0.1 + pressure.compliance + (pressure.stage === "late" ? 0.16 : 0), 0, 1);
  const complianceGap = Math.max(0, complianceNeed - complianceCoverage);
  const dailyRisk = suspended
    ? -2
    : Math.round(
        complianceGap * 18 +
          source.foodRisk * 8 +
          source.labelRisk * (1 - policy.clarity) * 10 +
          priceRisk +
          overloadRatio * 8 +
          extraMarketCount * 3 +
          pressure.risk +
          pressure.lateRisk,
      );
  const dailyHeat = suspended
    ? -3
    : Math.round(sales / 28 + policy.promoExposure * 2 + extraMarketCount * 2 + (pressure.stage === "late" ? 3 : 0));
  const dailyReputation = Math.round(policy.goodwill * 2 - overloadRatio * 4 - complianceGap * 5);
  const dailyDocuments = Math.round((policy.paperworkDiscipline + source.documentFit - 1) * 3);
  const dailyConscience = Math.round((source.conscience - 0.5) * 4 + (policy.clarity - 0.5) * 3);

  return {
    policy,
    source,
    suspended,
    marketCount,
    paidTrafficFactor: 1 + state.paidTraffic / 100,
    dailyBaseDemand: baseDemand,
    dailyPotentialDemand: demand,
    dailyCapacity: capacity,
    dailySales: sales,
    overloadRatio,
    complianceCoverage,
    complianceNeed,
    complianceGap,
    controversy: complianceGap + source.labelRisk,
    priceRisk,
    unitMargin,
    dailyWages: suspended ? wages * operatingModel.suspensionWageRate : wages,
    logisticsCost: logistics,
    sourceFixedCost,
    challengeCost,
    challengeStage: pressure.stage,
    dailyGrossProfit,
    dailyRisk,
    dailyHeat,
    dailyReputation,
    dailyDocuments,
    dailyConscience,
    cashPerMinute: dailyGrossProfit / operatingModel.minutesPerDay,
    heatPerMinute: 0,
    riskPerMinute: 0,
    reputationPerMinute: 0,
    documentsPerMinute: 0,
    consciencePerMinute: 0,
  };
}
