export function buildStoryContext(state, summary) {
  const completed = state.completed || {};
  const requests = state.requests || {};
  const wasAccepted = (id) => requests[id] === "accepted" || Boolean(completed[id]);

  const clear =
    state.flags?.clearLabel ||
    state.source === "goose" ||
    state.source === "freshDuck" ||
    state.productFocus === "duck";
  const risky = Boolean(state.flags?.shadyStock) || state.source === "frozenDuck" || summary.risk >= 52;
  const honest = clear && summary.risk < 50 && state.documents >= 55 && !state.flags?.shadyStock;

  return {
    day: state.calendarDay,
    summary,
    clear,
    risky,
    honest,
    cashTight: summary.bank < 170,
    rich: summary.bank >= 420,
    trusted: state.reputation >= 64 || state.documents >= 64,
    hot: summary.traffic >= 55 || state.heat >= 58,
    expanded: Boolean(
      state.markets?.cbd ||
        ["frog", "deer", "lion"].some((key) => state.markets?.[key]) ||
        wasAccepted("frog-campus") ||
        wasAccepted("campus-invite-2") ||
        Object.keys(state.manualCampusRequests || {}).some((key) => state.manualCampusRequests[key] === "completed"),
    ),
    acceptedAma: wasAccepted("orange-book-ama"),
    acceptedBusiness: Boolean(wasAccepted("business-district") || state.markets?.cbd),
  };
}

export function isStoryUnavailable(state, id) {
  return Boolean(state.completed?.[id]) || state.requests?.[id] === "rejected";
}

function pickFirstAvailable(state, ids) {
  return ids.find((id) => !isStoryUnavailable(state, id)) || null;
}

function primaryStoryId(context, state) {
  const { day } = context;

  if (day === 1) return "startup-idea";
  if (day === 2) return context.cashTight ? "supplier-start" : "student-link";
  if (day === 3) return state.source === "goose" ? "price-shock" : "supplier-three-stock";
  if (day === 4) return context.hot ? "student-link" : "pickup-screenshot";
  if (day === 5) return context.expanded ? "multi-campus-truth" : "frog-campus";
  if (day === 6) return context.trusted || context.hot ? "media-dm" : "frog-campus";
  if (day === 7) return context.hot || context.trusted ? "orange-book-ama" : "media-dm";
  if (day === 8) return context.rich || context.hot ? "business-district" : "orange-book-ama";

  if (day === 9) {
    if (context.risky) return "green";
    if (!context.clear) return "bone-comparison";
    return context.honest ? "name-drift" : "multi-campus-truth";
  }

  if (day === 10) {
    if (context.risky) return "bone-comparison";
    return context.honest ? "supplier-good-bad-duck" : "name-drift";
  }

  if (day === 11) {
    if (context.acceptedAma && (context.risky || context.hot)) return "ama-overflow";
    if (!context.honest && context.hot) return "media";
    return "supplier-good-bad-duck";
  }

  if (day === 12) {
    if (context.acceptedBusiness && context.risky) return "cbd-report";
    if (context.risky) return "complaint";
    return context.honest ? "final-supplier" : "media";
  }

  if (day === 13) {
    if (context.cashTight) return "supplier-good-bad-duck";
    if (context.risky) return "green";
    return context.honest ? "final-supplier" : "media";
  }

  if (day === 14) return context.acceptedBusiness || context.expanded ? "final-supplier" : "supplier-good-bad-duck";
  if (day === 15) return null;
  return null;
}

function fallbackStoryIds(context) {
  if (context.day < 6) {
    return ["startup-idea", "supplier-start", "supplier-three-stock", "student-link", "price-shock", "pickup-screenshot", "frog-campus"];
  }

  if (context.day < 9) {
    return ["media-dm", "orange-book-ama", "business-district", "frog-campus"];
  }

  if (context.honest) {
    return ["name-drift", "supplier-good-bad-duck", "final-supplier", "media"];
  }

  if (context.risky) {
    return ["green", "bone-comparison", "complaint", "cbd-report", "supplier-good-bad-duck", "final-supplier"];
  }

  return ["name-drift", "multi-campus-truth", "media", "supplier-good-bad-duck", "final-supplier"];
}

export function selectStoryId(state, summary, validIds = null) {
  const context = buildStoryContext(state, summary);
  if (context.day >= 15) return null;
  const valid = validIds ? new Set(validIds) : null;
  const candidates = [primaryStoryId(context, state), ...fallbackStoryIds(context)].filter((id) => id && (!valid || valid.has(id)));
  return pickFirstAvailable(state, candidates);
}

export function storyReasonForItem(state, summary, item) {
  if (!item) return "";
  const context = buildStoryContext(state, summary);

  if (context.day <= 5) return "前期经营：先把产品、价格、出餐和现金流跑顺。";

  if (["media-dm", "orange-book-ama", "business-district", "frog-campus"].includes(item.id)) {
    if (context.hot) return "中期活动：流量起来后，外部机会开始找上门。";
    if (context.trusted) return "中期活动：声望够高，采访和合作更容易出现。";
    return "中期活动：可以接活动，也可以拒绝，重点是别透支现金。";
  }

  if (["green", "bone-comparison", "complaint", "cbd-report"].includes(item.id)) {
    if (state.flags?.shadyStock || state.source === "frozenDuck") return "后期危机：低价或含糊货源开始反噬。";
    if (summary.risk >= 52) return "后期危机：风险累积到一定程度，质疑会更快出现。";
    return "后期危机：食品安全和品类质疑开始压上来。";
  }

  if (["name-drift", "supplier-good-bad-duck", "final-supplier"].includes(item.id) && context.honest) {
    return "诚信经营线：没有直接被举报，但成本、供货和承诺履约开始施压。";
  }

  return "后期经营：用前面积累的现金、声望和票据扛住压力。";
}
