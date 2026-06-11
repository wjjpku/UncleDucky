import {
  dayEnd,
  dayStart,
  marketOptions,
  policyOptions,
  priceBounds,
  sourceOptions,
  survivalDays,
  universityMarketKeys,
} from "./config.js";

export const saveKey = "duckyStudentsSave:v2";
export const saveVersion = 2;

export function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function savedObject(value) {
  return plainObject(value) ? value : {};
}

function savedArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback, min = -Infinity, max = Infinity, integer = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const bounded = Math.max(min, Math.min(max, number));
  return integer ? Math.round(bounded) : bounded;
}

function finiteBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function finiteString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function numericRecord(value, fallback = {}, min = -Infinity, max = Infinity) {
  const source = savedObject(value);
  const next = {};
  Object.keys(fallback).forEach((key) => {
    next[key] = finiteNumber(source[key], fallback[key], min, max);
  });
  Object.keys(source).forEach((key) => {
    if (key in next) return;
    const number = Number(source[key]);
    if (Number.isFinite(number)) next[key] = Math.max(min, Math.min(max, number));
  });
  return next;
}

function booleanRecord(value, fallback = {}) {
  const source = savedObject(value);
  const next = {};
  Object.keys(fallback).forEach((key) => {
    next[key] = finiteBoolean(source[key], fallback[key]);
  });
  Object.keys(source).forEach((key) => {
    if (key in next) return;
    if (typeof source[key] === "boolean") next[key] = source[key];
  });
  return next;
}

function stringRecord(value) {
  const source = savedObject(value);
  return Object.fromEntries(Object.entries(source).filter(([, item]) => typeof item === "string"));
}

function normalizeEffectQueue(value) {
  return savedArray(value)
    .map((entry) => {
      const item = savedObject(entry);
      const remaining = finiteNumber(item.remaining, 0, 0);
      const effects = numericRecord(item.effects, {}, -1000, 1000);
      return remaining > 0 && Object.keys(effects).length ? { remaining, effects } : null;
    })
    .filter(Boolean);
}

function normalizeChatHistory(value) {
  const source = savedObject(value);
  const next = {};
  Object.entries(source).forEach(([title, messages]) => {
    if (typeof title !== "string") return;
    const cleanMessages = savedArray(messages)
      .map((message) => {
        const item = savedObject(message);
        const who = finiteString(item.who, "");
        const text = finiteString(item.text, "");
        return who || text ? { who, text } : null;
      })
      .filter(Boolean);
    if (cleanMessages.length) next[title] = cleanMessages;
  });
  return next;
}

function normalizeUnread(value) {
  if (value === "已拒绝") return value;
  return finiteNumber(value, 0, 0, 99, true);
}

function normalizeKnownChats(value) {
  const source = savedObject(value);
  const next = {};
  Object.entries(source).forEach(([title, details]) => {
    if (typeof title !== "string") return;
    const item = savedObject(details);
    next[title] = {
      title,
      unread: normalizeUnread(item.unread),
      last: finiteString(item.last, ""),
      kind: enumValue(item.kind, ["chat", "request"], "chat"),
    };
  });
  return next;
}

function normalizeDayReports(value) {
  return savedArray(value)
    .map((report) => {
      const item = savedObject(report);
      const day = finiteNumber(item.day, 0, 1, survivalDays, true);
      if (!day) return null;
      return {
        day,
        cashDelta: finiteNumber(item.cashDelta, 0, -100000, 100000, true),
        sales: finiteNumber(item.sales, 0, 0, 100000, true),
        risk: finiteNumber(item.risk, 0, 0, 100, true),
        traffic: finiteNumber(item.traffic, 0, 0, 100, true),
        suspended: finiteBoolean(item.suspended, false),
        operatedRatio: finiteNumber(item.operatedRatio, 100, 0, 100, true),
      };
    })
    .filter(Boolean)
    .slice(-survivalDays);
}

function normalizeSupplyHistory(value) {
  return savedArray(value)
    .map((entry) => {
      const item = savedObject(entry);
      const source = enumValue(item.source, Object.keys(sourceOptions), "");
      const day = finiteNumber(item.day, 0, 1, survivalDays, true);
      if (!source || !day) return null;
      return {
        day,
        source,
        reason: finiteString(item.reason, ""),
        price: finiteNumber(item.price, 0, priceBounds.min, priceBounds.max, true),
        markets: finiteNumber(item.markets, 1, 1, Object.keys(marketOptions).length, true),
        sales: finiteNumber(item.sales, 0, 0, 100000, true),
      };
    })
    .filter(Boolean)
    .slice(-32);
}

function normalizeStringArray(value, maxLength = 100) {
  return savedArray(value).filter((item) => typeof item === "string").slice(-maxLength);
}

export function mergeSavedState(initialState, saved = {}) {
  const safeSaved = savedObject(saved);
  const next = { ...structuredClone(initialState), ...safeSaved };
  next.markets = booleanRecord(safeSaved.markets, initialState.markets);
  const savedContacts = savedObject(safeSaved.marketContacts);
  next.marketContacts = Object.fromEntries(
    Object.keys(initialState.marketContacts).map((key) => [
      key,
      enumValue(savedContacts[key], ["locked", "requested", "ready"], initialState.marketContacts[key]),
    ]),
  );
  next.selectedUniversityMarkets = [...savedArray(safeSaved.selectedUniversityMarkets)];
  next.marketRequestDue = numericRecord(safeSaved.marketRequestDue, {}, 0);
  const savedManualCampusRequests = savedObject(safeSaved.manualCampusRequests);
  next.manualCampusRequests = Object.fromEntries(
    Object.entries(savedManualCampusRequests).filter(
      ([key, status]) => universityMarketKeys.includes(key) && ["pending", "completed", "rejected"].includes(status),
    ),
  );
  next.marketSuspensions = numericRecord(safeSaved.marketSuspensions, {}, 0, survivalDays);
  next.dailyIncidentKeys = stringRecord(safeSaved.dailyIncidentKeys);
  next.dailyStoryKeys = stringRecord(safeSaved.dailyStoryKeys);
  next.routes = numericRecord(safeSaved.routes, initialState.routes, 0, 999);
  next.flags = booleanRecord(safeSaved.flags, initialState.flags);
  next.completed = booleanRecord(safeSaved.completed);
  next.replies = stringRecord(safeSaved.replies);
  const savedRequests = savedObject(safeSaved.requests);
  next.requests = Object.fromEntries(
    Object.entries(savedRequests).filter(([, status]) => ["pending", "accepted", "rejected"].includes(status)),
  );
  next.chatHistory = normalizeChatHistory(safeSaved.chatHistory);
  next.knownChats = normalizeKnownChats(safeSaved.knownChats);
  next.chatOrder = normalizeStringArray(safeSaved.chatOrder, 80);
  next.injectedMessages = booleanRecord(safeSaved.injectedMessages);
  next.overdueHits = numericRecord(safeSaved.overdueHits, {}, 0, 999);
  next.dayCostsCharged = numericRecord(safeSaved.dayCostsCharged, {}, 0, 999);
  next.seenFeatureUnlocks = booleanRecord(safeSaved.seenFeatureUnlocks);
  next.history = normalizeStringArray(safeSaved.history, 30);
  next.dayReports = normalizeDayReports(safeSaved.dayReports);
  next.supplyHistory = normalizeSupplyHistory(safeSaved.supplyHistory);
  next.seenTasks = booleanRecord(safeSaved.seenTasks);
  next.log = normalizeStringArray(safeSaved.log, 12);
  next.effectQueue = normalizeEffectQueue(safeSaved.effectQueue);
  next.dayIndex = finiteNumber(safeSaved.dayIndex, initialState.dayIndex, 0, 2, true);
  next.calendarDay = finiteNumber(safeSaved.calendarDay, initialState.calendarDay, 1, survivalDays, true);
  next.activeTask = finiteNumber(safeSaved.activeTask, initialState.activeTask, 0, 20, true);
  next.minute = finiteNumber(safeSaved.minute, initialState.minute, dayStart, dayEnd);
  next.started = finiteBoolean(safeSaved.started, initialState.started);
  next.ended = finiteBoolean(safeSaved.ended, initialState.ended);
  next.speed = enumValue(Number(safeSaved.speed), [0, 0.5, 1, 2, 4], initialState.speed);
  next.autoPausedForPending = finiteBoolean(safeSaved.autoPausedForPending, initialState.autoPausedForPending);
  next.tickCarry = finiteNumber(safeSaved.tickCarry, initialState.tickCarry, 0, 1);
  next.stallOpenedDay = finiteNumber(safeSaved.stallOpenedDay, initialState.stallOpenedDay, 0, survivalDays, true);
  next.stallOpenedMinute = finiteNumber(safeSaved.stallOpenedMinute, initialState.stallOpenedMinute, 0, dayEnd);
  next.cash = finiteNumber(safeSaved.cash, initialState.cash, 0);
  next.dayStartCash = finiteNumber(safeSaved.dayStartCash, next.cash, 0);
  next.reputation = finiteNumber(safeSaved.reputation, initialState.reputation, 0, 100);
  next.conscience = finiteNumber(safeSaved.conscience, initialState.conscience, 0, 100);
  next.risk = finiteNumber(safeSaved.risk, initialState.risk, 0, 100);
  next.heat = finiteNumber(safeSaved.heat, initialState.heat, 0, 100);
  next.family = finiteNumber(safeSaved.family, initialState.family, 0, 100);
  next.documents = finiteNumber(safeSaved.documents, initialState.documents, 0, 100);
  next.margin = finiteNumber(safeSaved.margin, initialState.margin, 0, 100);
  next.cost = finiteNumber(safeSaved.cost, initialState.cost, 0, 100);
  next.dailyExpense = finiteNumber(safeSaved.dailyExpense, initialState.dailyExpense, 0, 100);
  next.honestDays = finiteNumber(safeSaved.honestDays, initialState.honestDays, 0, survivalDays, true);
  next.incomeMultiplier = finiteNumber(safeSaved.incomeMultiplier, initialState.incomeMultiplier, 0, 1);
  next.incomeMultiplierUntilDay = finiteNumber(safeSaved.incomeMultiplierUntilDay, initialState.incomeMultiplierUntilDay, 0, survivalDays, true);
  next.incomeMultiplierReason = finiteString(safeSaved.incomeMultiplierReason, initialState.incomeMultiplierReason);
  next.activeMainTab = enumValue(safeSaved.activeMainTab, ["chat", "control"], initialState.activeMainTab);
  next.homeSchoolName = finiteString(safeSaved.homeSchoolName, initialState.homeSchoolName);
  next.price = finiteNumber(safeSaved.price, initialState.price, priceBounds.min, priceBounds.max, true);
  next.policy = enumValue(safeSaved.policy, Object.keys(policyOptions), initialState.policy);
  next.source = enumValue(safeSaved.source, Object.keys(sourceOptions), initialState.source);
  next.productFocus = enumValue(safeSaved.productFocus, ["duck", "goose", "cheapDuck"], initialState.productFocus);
  next.staff = finiteNumber(safeSaved.staff, initialState.staff, 1, 6, true);
  next.paidTraffic = finiteNumber(safeSaved.paidTraffic, initialState.paidTraffic, 0, 100);
  next.suspendedUntilDay = finiteNumber(safeSaved.suspendedUntilDay, initialState.suspendedUntilDay, 0, survivalDays, true);
  next.suspensionReason = finiteString(safeSaved.suspensionReason, initialState.suspensionReason);
  next.tickerText = finiteString(safeSaved.tickerText, initialState.tickerText);
  next.tickerUntil = finiteNumber(safeSaved.tickerUntil, initialState.tickerUntil, 0);
  next.activeChatTitle = finiteString(safeSaved.activeChatTitle, initialState.activeChatTitle);
  next.selectedUniversityMarkets = next.selectedUniversityMarkets.filter(
    (key, index, list) => universityMarketKeys.includes(key) && list.indexOf(key) === index,
  );
  Object.keys(next.markets).forEach((key) => {
    if (!marketOptions[key]) delete next.markets[key];
  });
  return next;
}

export function parseSavedGame(raw, initialState) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed.version !== saveVersion || !parsed.state) return null;
  const state = mergeSavedState(initialState, parsed.state);
  if (!state.started || state.ended) return null;
  return { ...parsed, state };
}

export function loadSavedGame(initialState, storage = safeStorage()) {
  if (!storage) return null;
  try {
    return parseSavedGame(storage.getItem(saveKey), initialState);
  } catch {
    return null;
  }
}

export function saveGameState(state, storage = safeStorage()) {
  if (!storage || !state.started) return false;
  try {
    storage.setItem(saveKey, JSON.stringify({ version: saveVersion, savedAt: Date.now(), state }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedGame(storage = safeStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(saveKey);
  } catch {
    // Ignore storage errors.
  }
}
