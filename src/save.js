export const saveKey = "duckyStudentsSave:v2";
export const saveVersion = 2;

export function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function mergeSavedState(initialState, saved = {}) {
  const next = { ...structuredClone(initialState), ...saved };
  next.markets = { ...initialState.markets, ...(saved.markets || {}) };
  next.marketContacts = { ...initialState.marketContacts, ...(saved.marketContacts || {}) };
  next.selectedUniversityMarkets = Array.isArray(saved.selectedUniversityMarkets) ? saved.selectedUniversityMarkets : [];
  next.marketRequestDue = { ...(saved.marketRequestDue || {}) };
  next.manualCampusRequests = { ...(saved.manualCampusRequests || {}) };
  next.marketSuspensions = { ...(saved.marketSuspensions || {}) };
  next.dailyIncidentKeys = { ...(saved.dailyIncidentKeys || {}) };
  next.dailyStoryKeys = { ...(saved.dailyStoryKeys || {}) };
  next.routes = { ...initialState.routes, ...(saved.routes || {}) };
  next.flags = { ...initialState.flags, ...(saved.flags || {}) };
  next.completed = { ...(saved.completed || {}) };
  next.replies = { ...(saved.replies || {}) };
  next.requests = { ...(saved.requests || {}) };
  next.chatHistory = { ...(saved.chatHistory || {}) };
  next.knownChats = { ...(saved.knownChats || {}) };
  next.chatOrder = Array.isArray(saved.chatOrder) ? saved.chatOrder : [];
  next.injectedMessages = { ...(saved.injectedMessages || {}) };
  next.overdueHits = { ...(saved.overdueHits || {}) };
  next.dayCostsCharged = { ...(saved.dayCostsCharged || {}) };
  next.seenFeatureUnlocks = { ...(saved.seenFeatureUnlocks || {}) };
  next.history = Array.isArray(saved.history) ? saved.history : [];
  next.dayReports = Array.isArray(saved.dayReports) ? saved.dayReports : [];
  next.seenTasks = { ...(saved.seenTasks || {}) };
  next.log = Array.isArray(saved.log) ? saved.log : [];
  next.effectQueue = Array.isArray(saved.effectQueue) ? saved.effectQueue : [];
  return next;
}

export function parseSavedGame(raw, initialState) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed.version !== saveVersion || !parsed.state?.started || parsed.state.ended) return null;
  return { ...parsed, state: mergeSavedState(initialState, parsed.state) };
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
