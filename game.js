import { operatingSnapshot } from "./src/economy.js";
import { pickIncidentTemplate } from "./src/incidents.js";
import { clearSavedGame, loadSavedGame, mergeSavedState, saveGameState } from "./src/save.js";
import { selectStoryId, storyReasonForItem } from "./src/storyEngine.js";
import { isRiskFailure, isStableSuccess } from "./src/successCriteria.js";
import {
  currencyName,
  dayEnd,
  dayStart,
  defaultHomeSchoolName,
  frogDuckGroup,
  frogGooseGroup,
  initialState,
  marketOptions,
  metricDetails,
  operatingModel,
  policyOptions,
  routeDetails,
  routeRules,
  sourceOptions,
  survivalDays,
  tickMinutes,
  tickMs,
  uncleGroupNick,
  universityMarketKeys,
  whaleDuckGroup,
  whaleGooseGroup,
} from "./src/config.js";
import { $, $$, clamp } from "./src/utils.js";

let state = structuredClone(initialState);
let timerId = null;
let tutorialIndex = 0;
let savedGame = loadSavedGame(initialState);
let lastSaveAt = 0;

const tutorialSteps = [
  {
    title: "先看两条线",
    body: "这个游戏分成聊天和经营两部分。聊天会推动剧情，经营会持续改变存款、日收益、风险和流量。",
    items: ["聊天里处理红点，回复会影响口碑、合规和剧情路线。", "经营里调价格、政策、货源、摊贩和区域。"],
  },
  {
    title: "钱按天持续流动",
    body: "一天大约 40 秒。存款会按当前日收益连续增长，日收益由价格、销量、成本和摊贩工资计算。",
    items: ["售价太低会压缩毛利，售价太高会压低需求。", "摊贩提高产能，但每天都要发工资。"],
  },
  {
    title: "扩张需要准备",
    body: "目标是稳定经营 15 天。新区域不是有钱就能开，你需要先有足够流量和摊贩，再付申请费，等好友通过后才能解锁。",
    items: ["新大学点位通常需要 2 个摊贩和 40+ 流量。", "果猫商业区需要更多人手和更高流量，监管也更强。"],
  },
  {
    title: "风险会慢慢累积",
    body: "货源、政策、超载、买流量和聊天选择都会改变风险。回消息前可以按暂停，想清楚再回复。",
    items: ["风险和流量是进度条，存款是具体鸭币。", "经营模块和剧情选择会一起塑造长期结局。"],
  },
  {
    title: "撑过 15 天",
    body: "这不是单次选择题，而是一局持续经营。随机乱选很容易破产或把风险推满，稳住现金、声望和票据才有后期空间。",
    items: ["前期先别急着扩张，保证日收益为正。", "中后期会出现采访、活动、入驻和质疑，前期积累会决定你能不能扛住。"],
  },
  {
    title: "给起步大学命名",
    body: "先定义你最开始摆摊的学校。最多输入 5 个字，游戏会自动补成“大学”，后续聊天、剧情和市场面板都会使用这个名字。",
    items: ["例如输入“河湾”，开局学校就是“河湾大学”。", "后续扩张会从青蛙大学、鹿大、白狮大学里抽取两个不重名的候选点位。"],
    setup: "school",
  },
];

function saveGame(throttled = false) {
  if (!state.started) return;
  const now = Date.now();
  if (throttled && now - lastSaveAt < 1800) return;
  if (saveGameState(state)) lastSaveAt = now;
}

function savedGameSummary() {
  if (!savedGame?.state) return "";
  const saved = savedGame.state;
  return `发现第 ${saved.calendarDay} 天存档，存款 ${Math.round(saved.cash)} ${currencyName}`;
}

function schoolBaseName(value = "") {
  return String(value).replace(/\s+/g, "").replace(/大学$/, "");
}

function normalizeSchoolName(value = "") {
  const cleaned = schoolBaseName(value);
  const base = cleaned || defaultHomeSchoolName.replace(/大学$/, "");
  return base.endsWith("大学") ? base : `${base}大学`;
}

function validateSchoolName(value = "") {
  const base = schoolBaseName(value);
  if ([...base].length > 5) {
    return { ok: false, base, message: "学校名最多五个字，不能保存。" };
  }
  return { ok: true, base };
}

function setSchoolNameError(message = "", isError = false) {
  const error = $("#schoolNameError");
  if (!error) return;
  error.textContent = message || "后续聊天和市场都会使用这个名字。";
  error.classList.toggle("error", isError);
}

function syncSchoolNameInput(input = $("#schoolNameInput")) {
  if (!input) return { ok: true, base: "" };
  const cleaned = schoolBaseName(input.value);
  if (input.value !== cleaned) input.value = cleaned;
  const validation = validateSchoolName(cleaned);
  if (!validation.ok) {
    setSchoolNameError(validation.message, true);
  } else if (cleaned) {
    setSchoolNameError(`将以“${cleaned}大学”开局。`);
  } else {
    setSchoolNameError();
  }
  return validation;
}

function homeSchoolName() {
  return normalizeSchoolName(state.homeSchoolName || defaultHomeSchoolName);
}

function homeGroupTitle(kind = "goose") {
  return `${homeSchoolName()}西门${kind === "duck" ? "鸭腿" : "鹅腿"}群34`;
}

function formatText(text = "") {
  return String(text)
    .replaceAll("白鲸大学", homeSchoolName())
    .replaceAll("白鲸", homeSchoolName().replace(/大学$/, ""))
    .replaceAll(whaleGooseGroup, homeGroupTitle("goose"))
    .replaceAll(whaleDuckGroup, homeGroupTitle("duck"));
}

function pickUniversityMarkets(seedText = "") {
  const seed = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0) || 7;
  const homeName = normalizeSchoolName(seedText);
  const candidates = universityMarketKeys.filter((key) => marketOptions[key]?.label !== homeName);
  return [...(candidates.length >= 2 ? candidates : universityMarketKeys)]
    .sort((a, b) => ((seed + a.charCodeAt(0) * 17) % 97) - ((seed + b.charCodeAt(0) * 17) % 97))
    .slice(0, 2);
}

function selectedUniversityMarkets() {
  if (!state.selectedUniversityMarkets?.length) {
    state.selectedUniversityMarkets = pickUniversityMarkets(homeSchoolName());
  }
  return state.selectedUniversityMarkets;
}

function visibleMarketKeys() {
  const homeName = homeSchoolName();
  const universities = universityMarketKeys.filter((key) => marketOptions[key]?.label !== homeName);
  return ["whale", ...universities, "cbd"];
}

function isUniversityMarket(key) {
  return universityMarketKeys.includes(key);
}

function manualCampusTaskId(marketKey) {
  return `manual-campus-${marketKey}`;
}

function resetConversationState() {
  state.activeTask = 0;
  state.activeChatTitle = "";
  state.chatHistory = {};
  state.knownChats = {};
  state.chatOrder = [];
  state.injectedMessages = {};
  state.seenTasks = {};
}

function groupsRenamedAfterIncident() {
  return Boolean(state.flags.clearLabel || state.flags.apology || state.flags.studentRefund);
}

function currentWhaleGroupTitle() {
  return groupsRenamedAfterIncident() ? homeGroupTitle("duck") : homeGroupTitle("goose");
}

const dailyNoticeTask = {
  id: "daily-notice",
  banner: "今日经营",
  icon: "营",
  phase: "开卖",
  title: "发今日经营通知",
  body: "",
  phone: {
    title: homeGroupTitle("goose"),
    messages: [
      [uncleGroupNick, "🙋配送信息都在下单小程序主页里啦~"],
      [uncleGroupNick, "🍖专属优惠券已发放，领券下单更划算!"],
      [uncleGroupNick, "晚7:30左右送到，等到11:20左右。毕业季啦，同学们吃一次少一次呢，想吃请下单啦🌹 @所有人"],
    ],
  },
  choices: [
    {
      title: "我确认今天开卖",
      desc: "发出今日经营通知。",
      cost: "开始经营",
      reply: "今天正常开卖，大家在小程序下单，到门口出示订单截图取餐。",
      effects: { cash: 3, heat: 3, margin: 2 },
      log: "我发出了今日经营通知。",
    },
  ],
};

function dailyNoticeForCurrentState() {
  return {
    ...dailyNoticeTask,
    id: `daily-notice-${state.calendarDay}`,
    phone: {
      ...dailyNoticeTask.phone,
      title: currentWhaleGroupTitle(),
    },
  };
}

const dailyIncidentTemplates = [
  {
    key: "rush-order",
    banner: "临时大单",
    phase: "订单",
    title: "午后突然来了一批团单",
    body: "白鲸大学社团临时要加一批烤腿，今天能卖更多，但如果不改取餐节奏，排队和核销会更乱。",
    messages: [
      ["社团同学", "阿叔，我们活动结束想统一取餐，能不能今天加 30 份？"],
      ["摊贩小李", "能做，但原来的队伍会被挤到后面。"],
    ],
    choices: [
      {
        title: "接单但改成分批取",
        desc: "多赚一点，同时控制排队。",
        cost: "稳健加单",
        reply: "可以加，但分两批取，小程序按时间段核销。",
        effects: { cash: 12, heat: 3, documents: 4, risk: -1 },
        log: "你把临时大单拆成分批取餐，收入增加，秩序还能解释。",
      },
      {
        title: "全部接下，现场排队",
        desc: "当天收入高，履约风险上升。",
        cost: "收益高",
        reply: "都来吧，到了现场排队取。",
        effects: { cash: 28, heat: 8, reputation: -3, documents: -4, risk: 8 },
        log: "临时大单把队伍拉长，钱进来了，投诉也更容易出现。",
      },
      {
        title: "拒绝加单保节奏",
        desc: "少赚，但当天压力下降。",
        cost: "保守",
        reply: "今天不加单，先保证已有订单准时取。",
        effects: { cash: -4, heat: -4, reputation: 2, risk: -3 },
        log: "你拒绝了临时大单，少赚一笔，但晚高峰更可控。",
      },
    ],
  },
  {
    key: "supplier-price",
    banner: "供货报价",
    phase: "货源",
    title: "供应商给了一个便宜批次",
    body: "老王说有一批便宜腿今天能到。价格好看，但批次票据要晚点补；正规批次贵一些，数量也少。",
    messages: [
      ["供应商老王", "便宜批次今晚能送，利润厚。"],
      ["供应商老王", "正规批次也有，但价高，别嫌贵。"],
    ],
    choices: [
      {
        title: "只要正规批次",
        desc: "毛利变薄，风险下降。",
        cost: "少赚",
        reply: "只要能对上票的批次，数量少就限量。",
        effects: { cash: -8, margin: -3, cost: 4, documents: 7, risk: -6, heat: -2 },
        log: "你选择正规批次，今天利润薄一些，但账本更稳。",
      },
      {
        title: "便宜批次先用",
        desc: "毛利提高，票据风险增加。",
        cost: "高毛利",
        reply: "便宜批次先送来，票据尽快补。",
        effects: { cash: 16, margin: 6, documents: -7, conscience: -5, risk: 9 },
        log: "便宜批次提高了毛利，也把票据缺口塞进了后续经营。",
      },
      {
        title: "两种批次分开标",
        desc: "操作麻烦，但解释空间最大。",
        cost: "费事",
        reply: "两种批次分开写，价格也分开，不混着卖。",
        effects: { cash: 3, documents: 6, reputation: 3, risk: -4, heat: -1 },
        log: "你把批次和价格分开标，顾客不一定都买账，但证据链清楚。",
      },
    ],
  },
  {
    key: "rainy-evening",
    banner: "天气变化",
    phase: "出摊",
    title: "晚高峰突然下雨",
    body: "雨一下，排队会少，迟到和冷掉的投诉也会变多。你可以做预售，也可以提前收摊。",
    messages: [
      ["摊贩小李", "雨有点大，保温箱不够用。"],
      ["学生A", "今天还按原时间到吗？"],
    ],
    choices: [
      {
        title: "改成预售取餐",
        desc: "少一点冲动单，履约更稳。",
        cost: "稳",
        reply: "今晚改成预售，按小程序时间段取餐。",
        effects: { cash: 4, documents: 5, heat: -2, risk: -4 },
        log: "你把雨天订单改成预售，销量没冲上去，但履约更稳。",
      },
      {
        title: "发券硬撑流量",
        desc: "订单回来，现场压力上升。",
        cost: "冲量",
        reply: "雨天券已发，今晚照常到点取餐。",
        effects: { cash: 12, heat: 8, reputation: -2, risk: 5, margin: -3 },
        log: "雨天券拉回了订单，也让迟到和保温压力变大。",
      },
      {
        title: "提前收摊",
        desc: "少赚，风险下降。",
        cost: "少卖",
        reply: "今晚雨太大，后续订单顺延或退款。",
        effects: { cash: -10, heat: -6, reputation: 2, risk: -5 },
        log: "你提前收摊，现金少了些，但把雨天履约风险压了下去。",
      },
    ],
  },
  {
    key: "staff-fatigue",
    banner: "摊贩状态",
    phase: "人员",
    title: "摊贩说今天有点顶不住",
    body: "连续高峰之后，摊贩开始疲劳。继续压订单会多卖，但出错率会上升。",
    messages: [
      ["摊贩小李", "今天手有点酸，再加单容易串单。"],
      ["摊贩小陈", "要不要少接一点？"],
    ],
    choices: [
      {
        title: "降低今日接单量",
        desc: "收入少，出错少。",
        cost: "保质量",
        reply: "今天少接一点，先把已有订单做好。",
        effects: { cash: -6, reputation: 4, risk: -5, documents: 3, heat: -2 },
        log: "你降低了今日接单量，少赚一点，摊位节奏稳住了。",
      },
      {
        title: "继续满负荷卖",
        desc: "收入高，串单风险高。",
        cost: "压榨产能",
        reply: "今天照常接，大家辛苦一下。",
        effects: { cash: 18, reputation: -5, risk: 8, documents: -5, heat: 5 },
        log: "你继续满负荷卖，收入上去了，串单和投诉也更容易出现。",
      },
      {
        title: "发加班补贴",
        desc: "花钱换稳定。",
        cost: "花钱",
        reply: "今天给加班补贴，订单按原计划但不再加量。",
        effects: { cash: -12, reputation: 3, risk: -3, conscience: 3 },
        log: "你发了加班补贴，摊贩状态稳住，现金少了一截。",
      },
    ],
  },
  {
    key: "platform-check",
    banner: "平台抽查",
    phase: "合规",
    title: "小程序后台要求补充资料",
    body: "平台提示商品页需要补充原料、价格和取餐说明。补得越清楚，短期转化可能越低，但后续风险更小。",
    messages: [
      ["平台助手", "请补充商品原料、批次和取餐说明。"],
      ["摊贩小李", "写太细会不会没人下单？"],
    ],
    choices: [
      {
        title: "完整补齐资料",
        desc: "转化慢，风险降。",
        cost: "合规",
        reply: "原料、批次、价格和取餐规则都补齐。",
        effects: { cash: -5, documents: 10, reputation: 4, risk: -7, heat: -4 },
        log: "你补齐了平台资料，订单慢了一些，但后续解释更容易。",
      },
      {
        title: "只补最低要求",
        desc: "影响小，风险小幅下降。",
        cost: "折中",
        reply: "先按平台最低要求补上。",
        effects: { cash: 2, documents: 4, risk: -2 },
        log: "你补了最低要求，平台暂时通过，但账本还不够细。",
      },
      {
        title: "先不改页面",
        desc: "今天订单不受影响，风险上升。",
        cost: "拖延",
        reply: "今天先不改，晚上再说。",
        effects: { cash: 10, documents: -6, reputation: -3, risk: 7, heat: 4 },
        log: "你暂时不改页面，今天转化没受影响，后台风险继续堆着。",
      },
    ],
  },
];

function dailyIncidentForCurrentState() {
  if (state.calendarDay < 9) return null;
  if (isBusinessSuspended()) {
    return {
      id: `daily-incident-suspension-${state.calendarDay}`,
      banner: "整顿日",
      icon: "整",
      phase: "停业",
      title: "今天不能正常出摊",
      body: `${state.suspensionReason || "停业整顿"}还在生效。今天没有销售收入，但可以把菜单、票据和退款口径补齐，降低后续风险。`,
      phone: {
        title: "摊位工作群",
        messages: [
          ["摊贩小李", "今天还出不出？有人在问。"],
          ["我", "先按整顿处理，别接新单。"],
        ],
      },
      choices: [
        {
          title: "整理票据和批次",
          desc: "没收入，但后续更稳。",
          cost: "合规",
          reply: "今天不接单，把票据、批次和商品页说明补齐。",
          effects: { cash: -4, documents: 9, reputation: 2, risk: -7, heat: -3 },
          log: "停业日用来补票据和批次，今天没卖货，但后续解释空间变大。",
        },
        {
          title: "发停业公告和退款口",
          desc: "口碑回升，现金承压。",
          cost: "补偿",
          reply: "今天停业，已下单的可以退款或顺延。",
          effects: { cash: -10, reputation: 7, conscience: 6, risk: -5, heat: -4 },
          log: "你发了停业公告和退款口，现金少了些，群里的猜测也少了些。",
        },
        {
          title: "偷偷接熟客小单",
          desc: "有一点收入，但破坏整顿。",
          cost: "高风险",
          reply: "熟客少量拿，别在群里说。",
          effects: { cash: 18, reputation: -5, documents: -8, conscience: -6, risk: 14, heat: 4 },
          log: "停业日偷偷接单带来现金，也让整顿承诺失去可信度。",
        },
      ],
    };
  }
  const snapshot = operatingSnapshot(state);
  const summary = getMetricSummary();
  const dayKey = String(state.calendarDay);
  const lockedKey = state.dailyIncidentKeys?.[dayKey];
  const template =
    dailyIncidentTemplates.find((item) => item.key === lockedKey) ||
    pickIncidentTemplate(dailyIncidentTemplates, snapshot, summary, state);
  state.dailyIncidentKeys ||= {};
  state.dailyIncidentKeys[dayKey] = template.key;
  const context =
    snapshot.overloadRatio > 0.35
      ? " 现在潜在订单已经明显超过产能，任何加单都会放大履约压力。"
      : summary.risk >= 70
        ? " 当前风险偏高，今天的选择会更容易影响后续经营。"
        : snapshot.dailyGrossProfit < 80
          ? " 今天日收益偏薄，现金选择会更敏感。"
          : "";
  return {
    id: `daily-incident-${template.key}-${state.calendarDay}`,
    banner: template.banner,
    icon: "突",
    phase: template.phase,
    title: template.title,
    body: `${template.body}${context}`,
    phone: {
      title: template.banner,
      messages: template.messages,
    },
    choices: template.choices,
  };
}

function chapterTasks() {
  return [dailyNoticeForCurrentState(), dailyIncidentForCurrentState(), ...manualCampusTasks(), ...scheduledStoryTasks()].filter(Boolean);
}

function getMetricSummary() {
  return {
    bank: Math.max(0, Math.round(state.cash)),
    risk: clamp(Math.round((state.risk * 0.55) + ((100 - state.documents) * 0.3) + ((100 - state.conscience) * 0.15))),
    traffic: trafficScore(),
  };
}

function trafficScore() {
  return clamp(Math.round((state.heat * 0.45) + (state.reputation * 0.3) + (state.paidTraffic * 0.25)));
}

function isBusinessSuspended() {
  return (state.suspendedUntilDay || 0) >= state.calendarDay;
}

const chapters = [
  {
    day: 1,
    title: "前期经营",
    summary: "先把价格、货源、出餐和现金流做好。前几天没有大危机，亏钱才是最大问题。",
    tasks: [
      {
        id: "startup-idea",
        banner: "供应商老王",
        icon: "想",
        phase: "初创",
        title: "先决定主打产品",
        body:
          "摊位刚起步，先不用想危机。我只需要决定主打产品：走高价鹅腿、稳定鸭腿，还是先做模糊的烤腿品牌。",
        phone: {
          title: "供应商老王",
          messages: [
            ["供应商老王", "叔，你别啥都卖，累。"],
            ["供应商老王", "就做一种腿，学生好记，群里也好接龙。"],
            ["供应商老王", "但名字要想好，名字一火，以后就不好改。"],
          ],
        },
        choices: [
          {
            title: "我先做校园烤腿",
            desc: "保留调整空间，起步慢。",
            cost: "慢热",
            reply: "先叫校园烤腿，卖什么就写什么。",
            effects: { cash: -2, reputation: 4, conscience: 5, documents: 6, risk: -4, heat: -2 },
            log: "你用校园烤腿起步，名字没那么抓人，但后面好解释。",
          },
          {
            title: "我主卖鹅腿",
            desc: "高价限量，声望更高。",
            cost: "容易火",
            reply: "主打鹅腿，少量预售，价格按成本来。",
            effects: { cash: -4, reputation: 8, conscience: 4, documents: 6, risk: -2, heat: 5 },
            log: "你选择主卖鹅腿，起步慢一点，但品牌更清楚。",
          },
          {
            title: "我主卖鸭腿",
            desc: "稳定便宜，适合长期经营。",
            cost: "稳经营",
            reply: "先主卖鸭腿，价格亲民，菜单写清楚。",
            effects: { cash: 6, reputation: 4, conscience: 5, documents: 5, risk: -3, heat: 3 },
            log: "你选择主卖鸭腿，利润不暴，但供应更稳定。",
          },
        ],
      },
      {
        id: "supplier-start",
        banner: "供应商老王",
        icon: "供",
        phase: "进货",
        title: "真正的鹅腿，没那么多",
        body:
          "我刚收到供货商消息。订单又爆了，但正经鹅腿要等；鸭边腿当天能送，冷库老货还能再便宜。",
        phone: {
          title: "供应商老王",
          messages: [
            ["供应商老王", "叔，鹅腿今天真没那么多。"],
            ["供应商老王", "鸭边腿当天到，口感差不多，利润厚。"],
            ["供应商老王", "冷库老货再便宜三成，别问太细。"],
          ],
        },
        choices: [
          {
            title: "我只要能对上票的鹅腿",
            desc: "少卖一点，先把原料说清楚。",
            cost: "稳妥但少赚",
            reply: "鹅腿有多少来多少，票据和批次一起给我。",
            effects: { cash: -8, reputation: 8, conscience: 8, documents: 10, risk: -6, heat: -4 },
            flag: ["clearLabel", true],
            log: "你要求供应商按票供货，第一天可卖数量明显下降。",
          },
          {
            title: "我先接这批无标便宜腿",
            desc: "当天爆单能接住，但菜单和货单开始分家。",
            cost: "利润高，隐患大",
            reply: "便宜腿先送来，群里别提太细。",
            effects: { cash: 18, conscience: -14, documents: -12, risk: 18, heat: 8 },
            flag: ["shadyStock", true],
            log: "便宜腿进了摊位，招牌上的字还停在鹅腿。",
          },
          {
            title: "我把菜单改叫校园烤腿",
            desc: "避开明确品类，但学生会追问。",
            cost: "热度会降",
            reply: "今天统一叫烤腿，原料按批次写。",
            effects: { cash: 4, reputation: 4, conscience: 5, documents: 6, risk: -8, heat: -8 },
            flag: ["clearLabel", true],
            log: "菜单改成校园烤腿，群里开始追问到底是什么腿。",
          },
        ],
      },
      {
        id: "supplier-three-stock",
        banner: "供应商老王",
        icon: "货",
        phase: "换货",
        title: "老王给了三种货",
        body:
          "老王发来新的报价：鹅腿要等，鲜鸭腿今晚能到，冻鸭边腿最便宜但批次复杂。群里订单已经压上来。",
        phone: {
          title: "供应商老王",
          messages: [
            ["供应商老王", "叔，今天三个方案。"],
            ["供应商老王", "鹅腿少，鲜鸭腿稳，冻鸭边腿便宜但票别问太细。"],
            ["供应商老王", "你要扩校区，供货名字就得早点想好。"],
          ],
        },
        choices: [
          {
            title: "我只收鹅腿和完整票据",
            desc: "数量少，账最清。",
            cost: "少卖",
            reply: "鹅腿和票据一起送，数量不够我就在小程序写限量。",
            effects: { cash: -9, reputation: 8, conscience: 9, documents: 12, risk: -8, heat: -5, cost: 8 },
            flag: ["clearLabel", true],
            log: "你砍掉便宜货，订单少了，供货记录清楚了。",
          },
          {
            title: "我收鲜鸭腿并改商品名",
            desc: "承认换货，利润一般。",
            cost: "热度下降",
            reply: "鲜鸭腿可以送，但小程序今天必须写鸭腿。",
            effects: { cash: 3, reputation: 5, conscience: 8, documents: 8, risk: -6, heat: -6, margin: -2 },
            flag: ["clearLabel", true],
            log: "你把换货和商品名绑在一起，争议少了，传奇感也少了。",
          },
          {
            title: "我收冻鸭边腿保利润",
            desc: "利润厚，食品和票据风险高。",
            cost: "高隐患",
            reply: "冻货先送来，票据后面补，群里不要提品类。",
            effects: { cash: 18, reputation: -8, conscience: -12, documents: -14, risk: 18, heat: 10, margin: 10 },
            flag: ["shadyStock", true],
            log: "冻鸭边腿进了后厨，成本压下去，风险也一起压进账本。",
          },
        ],
      },
      {
        id: "student-link",
        banner: "白鲸烤腿群",
        icon: "群",
        phase: "学生群",
        title: "小程序订单到了西南门",
        body:
          "我打开白鲸大学西南门烤腿群34，群里都在问小程序下单后到哪个门取、辣和不辣还有几份。",
        phone: {
          title: "白鲸大学西南门烤腿群34",
          messages: [
            ["鸭腿叔叔-排队中请留言", "🏃到了到了到了 请到西南门外左手边取"],
            ["鸭腿叔叔-排队中请留言", "🙋配送信息都在下单小程序主页里啦~"],
            ["鸭腿叔叔-排队中请留言", "🍖专属优惠券已发放，领券下单更划算!"],
            ["鸭腿叔叔-排队中请留言", "晚7:30左右送到，等到11:20左右。毕业季啦，同学们吃一次少一次呢，想吃请下单啦🌹 @所有人"],
            ["学生A", "辣和不辣腿到了吗？我小程序下单了。"],
            ["学生B", "到门口是给你看截图取吗？"],
          ],
        },
        choices: [
          {
            title: "我把取餐规则写进小程序",
            desc: "门口不乱，截图能核对。",
            cost: "更透明",
            reply: "小程序主页已写清：下单后到西南门外左手边，出示订单截图取餐，辣/不辣分开取。",
            effects: { cash: -4, reputation: 10, conscience: 7, documents: 12, risk: -10, heat: -3 },
            flag: ["invoice", true],
            log: "你把取餐点、订单截图和辣/不辣写进小程序，门口秩序稳了些。",
          },
          {
            title: "我只在群里喊到货",
            desc: "快，但门口容易乱。",
            cost: "短期有利",
            reply: "还有几份辣不辣都有，想吃的同学现在过来取🌹",
            effects: { cash: 16, reputation: -10, conscience: -9, documents: -12, risk: 15, heat: 13 },
            log: "你只在群里喊到货，没取到的人把混乱截图发到了别的群。",
          },
          {
            title: "我给质疑者免单券",
            desc: "用小恩小惠换安静，容易被看成心虚。",
            cost: "像在压事",
            reply: "有疑问的同学私我，补你们一张小程序优惠券。",
            effects: { cash: -4, reputation: -1, conscience: -2, documents: -3, risk: 4, heat: 8 },
            log: "几个质疑者收到了免单券，也有人把免单截图发出去了。",
          },
        ],
      },
      {
        id: "price-shock",
        banner: "白鲸烤腿群",
        icon: "价",
        phase: "定价",
        title: "鹅腿涨价后没人下单",
        body:
          "我把鹅腿按成本重新定价，群里突然安静。有人说这个价不如去店里吃，也有人问：以前十几块到底是什么腿？",
        phone: {
          title: "白鲸大学西南门烤腿群34",
          messages: [
            ["学生C", "今天小程序怎么贵这么多？"],
            ["学生D", "如果现在这个才是鹅腿，那以前是什么？"],
            ["群主", "叔，要不要把辣/不辣都改成限量预售？"],
          ],
        },
        choices: [
          {
            title: "我坚持鹅腿实价",
            desc: "订单会少，但账能说清。",
            cost: "卖得很慢",
            reply: "今天是鹅腿实价，小程序限量，辣/不辣各写清楚，嫌贵可以不下单。",
            effects: { cash: -8, reputation: 4, conscience: 8, documents: 8, risk: -5, heat: -8, margin: -6, cost: 8 },
            log: "你坚持鹅腿实价，小程序订单变慢，账本变清楚。",
          },
          {
            title: "我改卖鸭腿并明示",
            desc: "价格能下来，但人设会缩水。",
            cost: "流量降温",
            reply: "今晚小程序改成鸭腿，辣和不辣都会写清楚，价格也降下来。",
            effects: { cash: 2, reputation: 3, conscience: 6, documents: 10, risk: -8, heat: -10, margin: -2 },
            log: "你把商品改成明示鸭腿，热度少了，质疑也少了。",
          },
          {
            title: "我继续用老价格冲量",
            desc: "群里会热闹，但成本逻辑更说不通。",
            cost: "疑点变大",
            reply: "价格不变，老顾客放心下单。",
            effects: { cash: 12, reputation: -5, conscience: -9, documents: -8, risk: 10, heat: 14, margin: 8 },
            log: "你维持老价格冲量，群里热闹起来，质疑也跟着回来。",
          },
        ],
      },
      {
        id: "pickup-screenshot",
        banner: "白鲸烤腿群",
        icon: "截",
        phase: "取餐",
        title: "有人拿旧截图来取餐",
        body:
          "西南门口开始排队。有同学拿昨天的小程序截图来领今天的腿，代取同学也说分不清哪些截图已经核销过。",
        phone: {
          title: "白鲸大学西南门烤腿群34",
          messages: [
            ["代取同学", "叔，截图好多是昨天的，我这边核不过来。"],
            ["学生A", "我室友让我代取两份，截图在聊天记录里。"],
            ["学生B", "刚才有人拿同一张截图领了两次吧？"],
          ],
        },
        choices: [
          {
            title: "我改成小程序核销码",
            desc: "慢一点，但每单能对应。",
            cost: "门口变慢",
            reply: "今天开始到门口出示小程序核销码，旧截图不再取餐。",
            effects: { cash: -3, reputation: 7, documents: 10, risk: -8, heat: -2 },
            flag: ["invoice", true],
            log: "你把截图取餐改成核销码，队伍慢了些，重复领取少了。",
          },
          {
            title: "我让代取同学凭眼熟放行",
            desc: "最快，也最容易乱。",
            cost: "混乱扩大",
            reply: "今天先凭截图和名字取，熟面孔别卡太严。",
            effects: { cash: 10, reputation: -8, conscience: -4, documents: -10, risk: 10, heat: 8 },
            log: "门口速度快了，但重复截图和漏领截图一起流进群里。",
          },
          {
            title: "我给没取到的补券",
            desc: "暂时平息，现金承压。",
            cost: "补偿成本",
            reply: "没取到的私聊订单号，补一张小程序券。",
            effects: { cash: -8, reputation: 4, risk: -2, heat: 4, margin: -4 },
            log: "补券让一部分同学安静下来，也让更多人开始整理截图。",
          },
        ],
      },
      {
        id: "bone-comparison",
        banner: "白鲸烤腿群",
        icon: "骨",
        phase: "考据",
        title: "群里开始对比骨头",
        body:
          "群里有考据同学贴出鹅腿和鸭腿骨头对比图，还把小程序订单、取餐截图和实物照片拼在一起。",
        phone: {
          title: "白鲸大学西南门烤腿群34",
          messages: [
            ["考据同学", "这个骨头看起来不像鹅腿吧？"],
            ["学生C", "所以以前十几块到底是什么？"],
            ["群主", "叔，这个要不要你自己出来说一下？"],
          ],
        },
        choices: [
          {
            title: "我正面解释每批原料",
            desc: "承认差异，风险下降。",
            cost: "热度降温",
            reply: "不同批次会写清楚，鹅腿就写鹅腿，鸭腿就写鸭腿，小程序会同步改。",
            effects: { cash: -5, reputation: 8, conscience: 10, documents: 10, risk: -10, heat: -8 },
            flag: ["clearLabel", true],
            log: "你把骨头考据引回原料标注，讨论变少但订单也变慢。",
          },
          {
            title: "我说大家吃的是味道",
            desc: "绕开品类，容易被截图。",
            cost: "争议上升",
            reply: "大家一直吃的是味道和心情，别被几张图带偏。",
            effects: { cash: 4, reputation: -8, conscience: -7, documents: -6, risk: 10, heat: 14 },
            log: "你的回复被截成图，评论区开始反问商品名是不是也只是心情。",
          },
          {
            title: "我让群主撤回对比图",
            desc: "短期压住，截图外溢。",
            cost: "压事感强",
            reply: "群主先撤一下，别让不确定的信息乱传。",
            effects: { cash: 2, reputation: -6, conscience: -6, documents: -8, risk: 12, heat: 12 },
            log: "对比图被撤回后，撤回提示成了新的截图。",
          },
        ],
      },
      {
        id: "frog-campus",
        banner: "好友申请",
        icon: "蛙",
        phase: "扩张",
        title: "青蛙大学也想开团",
        request: {
          from: "青蛙大学代取群主",
          note: "我们这边也想订，能不能每晚送到东门？同学在小程序下单，到门口出示截图取。",
          accept: "我通过了青蛙大学代取群主好友申请。",
          reject: "我拒绝了青蛙大学代取，群主在广场平台说我只照顾白鲸大学。",
          rejectEffects: { heat: 5, reputation: -4 },
        },
        body:
          "青蛙大学代取群主想把订单拉过去。多一个校区意味着小程序要多一个取餐点，截图核销、保温和投诉都会翻倍。",
        phone: {
          title: "青蛙大学东门烤腿群35",
          messages: [
            ["青蛙群主", "叔，我们东门也能开团吗？"],
            ["青蛙群主", "同学小程序下单，到东门给我看截图取。"],
            ["青蛙群主", "不过送晚了他们会直接在广场平台挂人。"],
          ],
        },
        choices: [
          {
            title: "我只接明示品类的预售",
            desc: "扩张慢，但账清楚。",
            cost: "慢慢扩",
            reply: "可以，但小程序必须写清品类和东门取餐点，先限量预售。",
            effects: { cash: 4, reputation: 6, conscience: 5, documents: 8, risk: -3, heat: 4, margin: 2, cost: 3 },
            log: "青蛙大学开了限量预售，新增订单不多，但截图比较干净。",
          },
          {
            title: "我让群主复制旧小程序页",
            desc: "最快扩张，也最容易复制旧问题。",
            cost: "复制风险",
            reply: "你先复制白鲸这边小程序页，今晚直接收单。",
            effects: { cash: 16, reputation: -5, conscience: -8, documents: -10, risk: 12, heat: 12, margin: 8 },
            log: "青蛙大学订单冲上来，旧小程序页面里的含糊写法也一起扩散。",
          },
          {
            title: "我先不跨校配送",
            desc: "守住白鲸大学，少赚但少炸。",
            cost: "少赚",
            reply: "先不跨校，等我把供货和标签理顺再说。",
            effects: { cash: -2, reputation: 3, conscience: 4, risk: -4, heat: -2 },
            log: "你拒绝跨校配送，青蛙大学群里有人失望，但风险没有继续放大。",
          },
        ],
      },
    ],
  },
  {
    day: 2,
    title: "中期活动",
    summary: "采访、AMA 和商业区邀请会陆续出现。活动可以接，也可以拒绝，关键是别把现金和口碑透支掉。",
    tasks: [
      {
        id: "multi-campus-truth",
        banner: "多校烤腿群",
        icon: "续",
        phase: "继续售卖",
        title: "跨校之后还按老叫法卖吗",
        body:
          "白鲸和青蛙两个校区都在小程序下单。新增的人没吃过以前的摊，只看商品名、取餐点和订单截图判断自己买的是什么。",
        phone: {
          title: "青蛙大学东门烤腿群35",
          messages: [
            ["青蛙学生", "我们第一次买，小程序商品名能写清楚是什么腿吗？"],
            ["白鲸老客", "以前都叫鹅腿，突然改名是不是有事？"],
            ["群主", "叔，两个学校取餐点和商品名要统一，不然我不好解释。"],
          ],
        },
        choices: [
          {
            title: "我统一改成明示菜单",
            desc: "会掉热度，但跨校后更稳。",
            cost: "降温",
            reply: "两个学校小程序都统一写清楚：鹅腿就写鹅腿，鸭腿就写鸭腿，取餐截图照这个核销。",
            effects: { cash: -6, reputation: 8, conscience: 10, documents: 12, risk: -12, heat: -8, margin: -4 },
            log: "你把两个学校的小程序商品页统一改成明示菜单，短期订单少了。",
          },
          {
            title: "我维持老群名，只改小程序备注",
            desc: "保住热度，但解释空间很灰。",
            cost: "灰色过渡",
            reply: "群名先不改，小程序备注里会写原料，大家下单前看一下。",
            effects: { cash: 6, reputation: -2, conscience: -4, documents: 2, risk: 6, heat: 8, margin: 4 },
            log: "你把实际原料放进备注，群名继续负责传播。",
          },
          {
            title: "我让群主别讨论品类",
            desc: "最快压住争论，也最容易被截图。",
            cost: "高风险",
            reply: "先别在群里讨论品类，想买就去小程序下单。",
            effects: { cash: 14, reputation: -10, conscience: -12, documents: -12, risk: 16, heat: 12, margin: 8 },
            log: "你让群主压住品类讨论，截图很快传到广场平台。",
          },
        ],
      },
      {
        id: "name-drift",
        banner: "小程序后台",
        icon: "名",
        phase: "商品名",
        title: "商品名改成辣腿和不辣腿",
        body:
          "小程序后台有人建议把“鹅腿”从商品名里拿掉，只保留“辣腿”“不辣腿”。群里老客已经注意到名字变了。",
        phone: {
          title: "小程序运营群",
          messages: [
            ["运营同学", "叔，商品名要不要先改成辣腿/不辣腿？"],
            ["白鲸老客", "怎么突然不写鹅腿了？"],
            ["青蛙群主", "两个学校页面不一致，我这边解释不了。"],
          ],
        },
        choices: [
          {
            title: "我把原料写进商品名",
            desc: "清楚但掉热度。",
            cost: "降温",
            reply: "商品名直接写清楚：鹅腿/鸭腿，辣和不辣只是口味。",
            effects: { cash: -5, reputation: 8, conscience: 10, documents: 12, risk: -12, heat: -8 },
            flag: ["clearLabel", true],
            log: "你把品类写回商品名，流量降温，证据链变简单。",
          },
          {
            title: "我只写辣腿和不辣腿",
            desc: "避开字眼，质疑会上升。",
            cost: "模糊",
            reply: "先统一叫辣腿和不辣腿，大家看口味下单。",
            effects: { cash: 8, reputation: -4, conscience: -6, documents: -8, risk: 10, heat: 10 },
            log: "商品名变短了，截图里的疑问变长了。",
          },
          {
            title: "我在详情页小字备注",
            desc: "形式上有说明，但不醒目。",
            cost: "灰色",
            reply: "商品名不动，详情页会备注原料，大家下单前自己看。",
            effects: { cash: 5, reputation: -1, conscience: -3, documents: 3, risk: 5, heat: 6 },
            log: "原料进入详情页小字，支持者说已标注，质疑者说藏得太深。",
          },
        ],
      },
      {
        id: "complaint",
        banner: "好友申请",
        icon: "监",
        phase: "监管",
        title: "有人提交了投诉",
        request: {
          from: "燕园市监所",
          note: "你好，请通过好友并补充摊点、配售点和进货票据情况。",
          accept: "我通过了市监所好友申请。",
          reject: "我拒绝了市监所好友申请，电话和短信很快又来了。",
          rejectEffects: { risk: 16, heat: 6, reputation: -8, documents: -8 },
        },
        body:
          "我收到监管电话，对方要看经营主体、进货票据、小程序商品页和配售点。学生群同时弹出新投票：要不要集体退款，要不要找媒体。",
        phone: {
          title: "维权临时群",
          messages: [
            ["学生E", "不管好不好吃，写鹅腿就得说清楚。"],
            ["学生F", "有没有懂食品法的同学？"],
            ["群公告", "请保存小程序订单截图、付款记录和取餐点截图。"],
          ],
        },
        choices: [
          {
            title: "我主动停售并配合检查",
            desc: "短期赔钱，长期风险下降。",
            cost: "赔钱降风险",
            reply: "今天停售，小程序订单、票据和退款名单我整理给监管。",
            effects: { cash: -14, reputation: 8, conscience: 10, documents: 14, risk: -18, heat: -8 },
            flag: ["apology", true],
            log: "你收起招牌，开始整理票据和退款名单。",
          },
          {
            title: "我临时补票据",
            desc: "供应商说能补一套看起来像样的材料。",
            cost: "风险很高",
            reply: "票据晚上补齐，批次先别问。",
            effects: { cash: 5, reputation: -8, conscience: -12, documents: -18, risk: 22, heat: 12 },
            log: "票据补上了，但批次和日期对不上。",
          },
          {
            title: "我把锅推给供应商",
            desc: "你说自己也是受害者。",
            cost: "口碑受损",
            reply: "我也是被供货商坑了，先等他们解释。",
            effects: { cash: -2, reputation: -10, conscience: -6, documents: -6, risk: 6, heat: 15 },
            log: "供应商电话打不通，网友开始问为什么招牌是你写的。",
          },
        ],
      },
      {
        id: "media",
        banner: "广场平台",
        icon: "媒",
        phase: "舆论",
        title: "热榜标题只剩四个字",
        body:
          "我看到本地号、探店号、法律博主都来了。评论区开始引用消费者知情权和虚假宣传，公关公司给我三套方案。",
        phone: {
          title: "广场平台",
          messages: [
            ["热榜", "#鸭腿叔叔小程序商品名改了#"],
            ["私信", "本地号想采访你，问以前十几块是不是鸭腿。"],
            ["评论", "别讲烟火气，先把小程序商品页截图发出来。"],
          ],
        },
        choices: [
          {
            title: "我全额退款并公开道歉",
            desc: "承认标识问题，停止人设表演。",
            cost: "代价很大",
            reply: "我会退款，也会把小程序商品名、原料和取餐点标注改清楚。",
            effects: { cash: -24, reputation: 14, conscience: 16, documents: 16, risk: -16, heat: -10 },
            flag: ["studentRefund", true],
            log: "退款入口发出后，骂声没有立刻停，但证据链开始变简单。",
          },
          {
            title: "我买公关稿洗热榜",
            desc: "把食品问题改写成普通人创业不易。",
            cost: "花钱控评",
            reply: "稿子重点写多年辛苦，别写品类。",
            effects: { cash: -12, reputation: -4, conscience: -12, documents: -8, risk: 10, heat: -6 },
            flag: ["prAgency", true],
            log: "几篇同款通稿上线，评论区开始逐句对照。",
          },
          {
            title: "我直播硬刚网友",
            desc: "流量会爆，但每句话都会被截屏。",
            cost: "热度爆炸",
            reply: "你们懂不懂做生意？想吃就买，不想吃别买。",
            effects: { cash: 8, reputation: -18, conscience: -8, documents: -10, risk: 18, heat: 22 },
            log: "你在直播里反问学生懂不懂生意，切片一小时内传遍全网。",
          },
        ],
      },
      {
        id: "media-dm",
        banner: "白鲸大学采访",
        icon: "问",
        phase: "采访",
        title: "白鲸大学邀请采访",
        body:
          "白鲸大学校园号想做一次摊位采访。前期没有危机，这是一个涨声望的机会；你也可以拒绝，把精力留给经营。",
        phone: {
          title: "白鲸大学校园号",
          messages: [
            ["校园号编辑", "叔，最近同学都在买，可以采访一下你怎么定价和备货吗？"],
            ["校园号编辑", "不用讲太复杂，拍摊位和菜单就行。"],
            ["学生", "想看叔怎么决定主卖鹅腿还是鸭腿。"],
          ],
        },
        choices: [
          {
            title: "接受采访，展示菜单",
            desc: "声望上升，流量小涨。",
            cost: "稳妥曝光",
            reply: "可以采访，菜单和价格都拍清楚。",
            effects: { cash: 6, reputation: 10, documents: 6, risk: -3, heat: 8 },
            flag: ["clearLabel", true],
            log: "你接受了白鲸大学采访，摊位曝光增加，菜单也更清楚。",
          },
          {
            title: "只拍摊位，不谈供货",
            desc: "流量更高，说明不够完整。",
            cost: "轻微隐患",
            reply: "可以拍摊位故事，供货细节先不展开。",
            effects: { cash: 10, reputation: 4, documents: -2, risk: 4, heat: 12 },
            log: "采访带来更多订单，但供货说明没有一起补上。",
          },
          {
            title: "婉拒采访",
            desc: "少一些流量，专心经营。",
            cost: "保守",
            reply: "这周先不采访，我先把出餐和账本做好。",
            effects: { cash: -1, reputation: 2, risk: -2, heat: -3 },
            log: "你婉拒了采访，摊位没有大火，但经营节奏更安静。",
          },
        ],
      },
      {
        id: "orange-book-ama",
        banner: "小橙书AMA",
        icon: "书",
        phase: "活动",
        title: "小橙书 AMA 免费领腿",
        body:
          "小橙书 AMA 活动来了。参加活动的学生在小橙书发笔记，到门口给工作人员看发布记录和团号，就能免费领一份。",
        phone: {
          title: "小橙书AMA活动群",
          messages: [
            ["活动同学", "今晚 8:10-8:30 之间送到吗？外面冷，到了群里通知一下🌹"],
            ["鸭腿叔叔-排队中请留言", "参加小橙书 AMA 的同学，到西南门外领取，工作人员看发布的笔记和团号就可以取。"],
            ["学生", "我下单了但没赶上，可以免费领吗？"],
          ],
        },
        choices: [
          {
            title: "我只给参加 AMA 的人领",
            desc: "活动边界清楚。",
            cost: "少点热度",
            reply: "只限参加小橙书 AMA 并能出示笔记和团号的同学领取，领完为止。",
            effects: { cash: -6, reputation: 5, documents: 6, risk: -4, heat: 4, margin: -4 },
            log: "你把 AMA 免费领取规则写清楚，活动没炸，但热度有限。",
          },
          {
            title: "我让想吃的都免费领",
            desc: "迅速赚口碑，也会冲击现金。",
            cost: "现金压力",
            reply: "没取到的、想吃的同学都可以来免费领，领完为止🌹🌹",
            effects: { cash: -18, reputation: 10, heat: 14, risk: 5, margin: -10 },
            log: "你把 AMA 扩成免费派送，门口排队变长，现金压力也上来了。",
          },
          {
            title: "我要求先发好评笔记",
            desc: "像营销，也像诱导。",
            cost: "反噬风险",
            reply: "先发小橙书笔记，截图给工作人员看，再领免费腿。",
            effects: { cash: -4, reputation: -8, conscience: -8, documents: -6, risk: 12, heat: 16 },
            log: "你要求先发笔记再领，活动截图被质疑成诱导好评。",
          },
        ],
      },
      {
        id: "ama-overflow",
        banner: "小橙书AMA",
        icon: "领",
        phase: "免费领",
        title: "免费领队伍失控",
        body:
          "AMA 活动截图被转到群里。没参加活动的同学也来排队，有人说自己发了笔记但没领到，有人要求订单和免费领都补。",
        phone: {
          title: "小橙书AMA活动群",
          messages: [
            ["活动同学", "我发了笔记，工作人员说领完了？"],
            ["白鲸学生", "没参加 AMA 可以领吗？我小程序也下单了。"],
            ["工作人员", "门口分不清订单队伍和免费领队伍了。"],
          ],
        },
        choices: [
          {
            title: "我只认活动记录",
            desc: "规则清楚，现场会吵。",
            cost: "口碑受压",
            reply: "只认小橙书 AMA 发布记录和团号，订单队伍和免费领队伍分开。",
            effects: { cash: -2, reputation: 3, documents: 8, risk: -5, heat: -2 },
            log: "你把免费领规则拉回活动记录，现场有人不满，但证据清楚。",
          },
          {
            title: "我给所有排队的人发券",
            desc: "先灭火，现金继续掉。",
            cost: "补偿扩大",
            reply: "今天没领到的都登记，统一补小程序券。",
            effects: { cash: -16, reputation: 6, risk: -2, heat: 8, margin: -8 },
            log: "补券名单越拉越长，短期口碑稳住，现金继续被拖住。",
          },
          {
            title: "我要求先发笔记再补领",
            desc: "能换流量，也像诱导。",
            cost: "营销反噬",
            reply: "没领到的先补一条小橙书笔记，截图给工作人员再登记。",
            effects: { cash: -4, reputation: -10, conscience: -8, documents: -6, risk: 14, heat: 18 },
            log: "补领规则被截图成诱导发帖，活动从福利变成营销争议。",
          },
        ],
      },
      {
        id: "son-screenshot",
        banner: "儿子",
        icon: "子",
        phase: "家人",
        title: "朋友圈截图被搬运",
        body:
          "儿子发来消息，说他的朋友圈旅游照被人搬到广场平台下面，评论开始把摊位利润、家庭消费和食品标识问题混在一起算。",
        phone: {
          title: "儿子",
          messages: [
            ["儿子", "爸，我朋友圈被人截图了。"],
            ["儿子", "他们说你卖腿的钱都给我旅游了，这也太离谱。"],
            ["儿子", "我要不要发个广场平台解释一下？"],
          ],
        },
        choices: [
          {
            title: "我让他先删朋友圈",
            desc: "少一个靶子，但像是在清痕迹。",
            cost: "热度略降",
            reply: "先删掉，别再把家里的消费放到网上。",
            effects: { heat: -5, risk: 3, reputation: -2, family: 4 },
            log: "儿子删了朋友圈，但网友开始问为什么突然删。",
          },
          {
            title: "我让他别发声",
            desc: "不扩大话题，把焦点拉回商品本身。",
            cost: "稳一点",
            reply: "你别回应，这事是我的摊位问题，不要把你卷进来。",
            effects: { heat: -3, reputation: 3, conscience: 3, risk: -2 },
            log: "你把儿子从舆论里按住，讨论短暂回到原料和标识。",
          },
          {
            title: "我让他替我解释",
            desc: "家人下场会带来同情，也会带来更多截图。",
            cost: "流量上升",
            reply: "你可以说两句，但别提进货和价格。",
            effects: { heat: 12, reputation: -5, risk: 6, family: -4 },
            log: "儿子的解释被切成短视频，话题从摊位扩散到家庭消费。",
          },
        ],
      },
      {
        id: "green",
        banner: "好友申请",
        icon: "图",
        phase: "食品疑点",
        title: "群里翻出旧图",
        request: {
          from: "食品检测博主",
          note: "我看到绿色截图了，可以免费帮你做一次公开送检，但结果会同步发广场平台。",
          accept: "我通过了检测博主好友申请。",
          reject: "我拒绝了检测博主，搬运号开始说我不敢检测。",
          rejectEffects: { risk: 10, heat: 12, reputation: -7 },
        },
        body:
          "我看到有人发出疑似绿色物质截图，还配了小程序订单截图。我不知道它到底是腌料、葱汁、拍摄色差还是变质，但它已经和“冷库老货”四个字绑在一起传播。",
        phone: {
          title: "小橙书搬运群",
          messages: [
            ["检测志愿者", "阿叔，请问腿中间绿色的是什么，好像味道不太对。"],
            ["搬运号", "旧图和小程序订单截图都找到了，标题怎么写？"],
            ["评论", "这到底是葱汁腌料还是坏了？"],
            ["学生H", "没有检测报告就别瞎定性，但商家得解释。"],
          ],
        },
        choices: [
          {
            title: "我送检并暂停相关批次",
            desc: "把未知问题交给检测，而不是嘴硬。",
            cost: "花钱求稳",
            reply: "这批先停，样品送检，结果出来再说。",
            effects: { cash: -10, reputation: 9, conscience: 10, documents: 12, risk: -15, heat: -6 },
            log: "你暂停相关批次并送检，讨论从猜测转向等待结果。",
          },
          {
            title: "我说是葱叶汁腌制",
            desc: "解释最省钱，但没有证据支撑。",
            cost: "解释牵强",
            reply: "这是大葱叶榨汁腌制浸泡形成的绿色食品，无任何添加剂，无任何危害，请放心食用🌹",
            effects: { cash: 4, reputation: -12, conscience: -8, documents: -10, risk: 12, heat: 15 },
            log: "你把绿色截图解释成葱叶汁腌制，网友开始逐帧放大。",
          },
          {
            title: "我让儿子怼回去",
            desc: "很解气，也很容易出圈。",
            cost: "越描越热",
            reply: "你别骂太狠，就说不吃可以别吃。",
            effects: { reputation: -10, conscience: -6, risk: 10, heat: 14 },
            log: "儿子的回怼截图比原图传播得更快。",
          },
        ],
      },
      {
        id: "business-district",
        banner: "好友申请",
        icon: "商",
        phase: "商圈",
        title: "果猫商业区邀请入驻",
        request: {
          from: "果猫商业区招商经理",
          note: "我们夜市档口缺一个爆款小吃。押一付三，统一收银，能不能把鸭腿叔叔开进来？",
          accept: "我通过了商业区招商经理好友申请。",
          reject: "我拒绝了商业区档口，招商经理把档期转给了另一个烤腿摊。",
          rejectEffects: { cash: -3, heat: -3, reputation: 2 },
        },
        body:
          "商业区想要我的流量，但合同要求统一菜单、统一收银、稳定供货。进商圈能把摊位变店，也会把小摊问题变成连锁问题。",
        phone: {
          title: "果猫商业区招商经理",
          messages: [
            ["招商经理", "叔，你这个热度适合进夜市。"],
            ["招商经理", "但我们要固定菜单和供货证明。"],
            ["招商经理", "押金今天定，晚了档口就没了。"],
          ],
        },
        choices: [
          {
            title: "我签短租试营业",
            desc: "花钱试水，保留退出空间。",
            cost: "押金压力",
            reply: "先签短租，菜单和原料都按合同写清楚。",
            effects: { cash: -12, reputation: 6, documents: 8, risk: -3, heat: 8, margin: 4, cost: 10 },
            log: "你进入商业区试营业，客流变稳定，押金也压住了现金。",
          },
          {
            title: "我只授权他们挂名",
            desc: "不出人不出票，来钱快但失控。",
            cost: "失控扩张",
            reply: "你们可以挂鸭腿叔叔名号，供货自己解决。",
            effects: { cash: 18, reputation: -10, conscience: -12, documents: -14, risk: 18, heat: 14, margin: 10 },
            log: "商业区出现挂名档口，菜单和口味很快开始变形。",
          },
          {
            title: "我拒绝进商圈",
            desc: "继续守摊，少赚少扩散。",
            cost: "热度回落",
            reply: "我现在先不进商圈，摊位还没理顺。",
            effects: { cash: -2, reputation: 4, conscience: 5, risk: -5, heat: -6 },
            log: "你拒绝了商业区档口，热度慢下来，摊位问题也没有被放大。",
          },
        ],
      },
    ],
  },
  {
    day: 3,
    title: "后期危机",
    summary: "食品安全和鹅鸭质疑开始升温。前期攒下的存款、声望和清楚菜单会决定你能不能扛住。",
    tasks: [
      {
        id: "supplier-good-bad-duck",
        banner: "供应商老王",
        icon: "鸭",
        phase: "复问供货",
        title: "这次不是鹅鸭，是好鸭坏鸭",
        body:
          "老王又来问供货。这一次他不再问鹅腿还是鸭腿，而是问你要稳定鲜鸭腿，还是更便宜的边角冻货。",
        phone: {
          title: "供应商老王",
          messages: [
            ["供应商老王", "叔，商业区要稳定量，学校也还在要。"],
            ["供应商老王", "好鸭腿贵，票清楚；便宜货能撑量，但出问题别说我没提醒。"],
            ["供应商老王", "你现在要的是利润，还是别再添新坑？"],
          ],
        },
        choices: [
          {
            title: "我只要稳定鲜鸭腿",
            desc: "成本高，但和公告能对上。",
            cost: "利润变薄",
            reply: "只要票据清楚的鲜鸭腿，商业区和学校都按这个写。",
            effects: { cash: -8, reputation: 8, conscience: 8, documents: 12, risk: -10, heat: -3, cost: 8, margin: -5 },
            flag: ["clearLabel", true],
            log: "你把供货从真假问题收回到稳定批次，利润薄了，解释空间变少了。",
          },
          {
            title: "我混着用，别断货",
            desc: "能撑订单，批次更乱。",
            cost: "批次风险",
            reply: "先混着送，别让果猫和学校断货，票据后面补。",
            effects: { cash: 14, reputation: -8, conscience: -10, documents: -14, risk: 18, heat: 10, margin: 8 },
            flag: ["shadyStock", true],
            log: "你用混批撑住订单，也把后续检查的线索搅在一起。",
          },
          {
            title: "我先砍掉商业区量",
            desc: "少赚，保住学校端。",
            cost: "收缩",
            reply: "商业区先减量，学校这边能清楚交付再说。",
            effects: { cash: -5, reputation: 5, conscience: 6, documents: 5, risk: -7, heat: -6, margin: -2 },
            log: "你主动砍掉商业区量，现金少了些，供货压力也降了。",
          },
        ],
      },
      {
        id: "cbd-report",
        banner: "果猫群",
        icon: "爆",
        phase: "爆点",
        title: "果猫商业区 群被举报",
        body:
          "果猫商业区 群里有人举报，说你在商业区卖的仍按鹅腿故事传播，实际公告又写成鸭腿。群公告被截图，开始往广场平台扩散。",
        phone: {
          title: "果猫商业区-6群鸭腿叔叔(206)",
          messages: [
            ["群公告", "大家好，果猫本周不过来了，下周待定。被群里某位商圈顾客举报，正在配合相关部门工作。"],
            [uncleGroupNick, "原材料是鸭腿，以后都会给大家写清楚，介意请勿下单。鸭腿叔叔叫了十几年，会重新核对标识和原料说明，耽误大家时间，万分抱歉🙏"],
            ["商圈顾客A", "所以果猫这边之前买的到底是什么？"],
            ["转发截图", "公告已经发广场平台了。"],
          ],
        },
        choices: [
          {
            title: "我暂停果猫并发清楚公告",
            desc: "承认标识问题，把商业区先停掉。",
            cost: "止损",
            reply: "果猫先暂停，所有商品名、原料和退款方式我重新写清楚，再决定是否恢复。",
            effects: { cash: -18, reputation: 8, conscience: 12, documents: 16, risk: -18, heat: -8, margin: -8 },
            flag: ["apology", true],
            log: "你把果猫线先停掉，公告不再讲故事，开始讲原料和退款。",
          },
          {
            title: "我说只是群名历史遗留",
            desc: "沿用品牌说法，争议继续。",
            cost: "解释承压",
            reply: "群名是大家叫习惯了，买的是味道和支持，原料以后会写清楚。",
            effects: { cash: 6, reputation: -10, conscience: -10, documents: -8, risk: 16, heat: 18 },
            log: "你把问题解释成群名历史，评论区开始逐张截图对照。",
          },
          {
            title: "我请公关改写成小本生意",
            desc: "能拖热榜，信任更空。",
            cost: "公关化",
            reply: "公告重点写小本生意和感谢支持，原料问题放到后半段。",
            effects: { cash: -10, reputation: -6, conscience: -12, documents: -8, risk: 10, heat: 16 },
            flag: ["prAgency", true],
            log: "公关稿把果猫举报写成误会，网友把公告原文贴在评论区。",
          },
        ],
      },
      {
        id: "final-supplier",
        banner: "冷链报价",
        icon: "链",
        phase: "配送",
        title: "多校配送开始要冷链",
        body:
          "白鲸大学、青蛙大学和商业区的小程序订单时间撞在一起。老王不再聊便宜货，他拿来一张冷链报价：保温箱、车费、押金、超时赔付都要算。",
        phone: {
          title: "供应商老王",
          messages: [
            ["供应商老王", "现在不是一车货送一个门口了。"],
            ["供应商老王", "三条线同时跑，要冷链箱和押金。"],
            ["供应商老王", "不用冷链也行，坏一单他们拿订单截图找你。"],
          ],
        },
        choices: [
          {
            title: "我付押金上冷链",
            desc: "成本高，但能支撑扩张。",
            cost: "现金吃紧",
            reply: "冷链上，三条线都按批次和温控记录走。",
            effects: { cash: -18, reputation: 10, conscience: 8, documents: 14, risk: -14, heat: 2, margin: -8, cost: 12 },
            flag: ["invoice", true],
            log: "你付了冷链押金，多校配送变正规，现金被压得很紧。",
          },
          {
            title: "我让骑手常温跑",
            desc: "省钱扩张，投诉会集中爆。",
            cost: "配送隐患",
            reply: "先常温跑，晚高峰之前送到就行。",
            effects: { cash: 16, reputation: -12, conscience: -10, documents: -8, risk: 22, heat: 10, margin: 8 },
            flag: ["shadyStock", true],
            log: "你让骑手常温跑三条线，省下了钱，也把投诉集中到配送时间。",
          },
          {
            title: "我砍掉跨区订单",
            desc: "收缩范围，保住交付。",
            cost: "少赚降压",
            reply: "先砍掉跨区订单，只保留能准时送到的点。",
            effects: { cash: -6, reputation: 5, conscience: 7, documents: 5, risk: -12, heat: -10, margin: -3 },
            log: "你砍掉跨区订单，少赚了一截，但配送投诉明显少了。",
          },
        ],
      },
      {
        id: "final-public",
        banner: "广场平台",
        icon: "告",
        phase: "终局",
        title: "摊灯亮到最后一晚",
        body:
          "我面前摆着群聊、票据、朋友圈、热榜、论坛旧稿和监管记录。我可以把这门生意变回生意，也可以继续把它当成人设。",
        phone: {
          title: "全网热议",
          messages: [
            ["学生G", "我要的不是完美阿叔，是别骗我。"],
            ["媒体私信", "方便接受采访吗？"],
            ["系统提示", "你的经营即将结算。"],
          ],
        },
        choices: [
          {
            title: "我公开账本，重开小摊",
            desc: "把供应商、品类、价格、退款都写清楚。",
            cost: "结算",
            reply: "账本公开，菜单重写，过去买错的按规则退。",
            effects: { reputation: 12, conscience: 14, documents: 18, risk: -16, heat: -10 },
            flag: ["clearLabel", true],
            log: "你把账本贴在摊车旁边，队伍短了，但问题少了。",
          },
          {
            title: "我换个城市重新开号",
            desc: "旧账号沉了，新人设可以再起。",
            cost: "结算",
            reply: "旧号暂停，新号从清楚菜单重新开始。",
            effects: { cash: 12, reputation: -18, conscience: -16, documents: -12, risk: 10, heat: 10 },
            log: "新号第一条视频还是熟悉的炉火和熟悉的话术。",
          },
          {
            title: "我交给公关公司运营",
            desc: "从卖腿转向卖故事。",
            cost: "结算",
            reply: "以后内容、回应、菜单都走公关口径。",
            effects: { cash: 8, reputation: -8, conscience: -12, documents: -8, risk: 7, heat: 18 },
            flag: ["prAgency", true],
            log: "菜单变成了脚本，顾客变成了镜头里的背景。",
          },
        ],
      },
    ],
  },
];

function allStoryTasks() {
  return [...chapters.flatMap((chapter) => chapter.tasks), buildCampusInviteTask("campus-invite-2", selectedUniversityMarkets()[1])].filter(Boolean);
}

function storyTaskById(id) {
  if (id === "frog-campus") return buildCampusInviteTask("frog-campus", selectedUniversityMarkets()[0]);
  if (id === "campus-invite-2") return buildCampusInviteTask("campus-invite-2", selectedUniversityMarkets()[1]);
  if (id.startsWith("manual-campus-")) return buildCampusInviteTask(id, id.replace("manual-campus-", ""));
  return allStoryTasks().find((item) => item.id === id);
}

function manualCampusTasks() {
  return Object.entries(state.manualCampusRequests || {})
    .filter(([, status]) => status === "pending")
    .map(([market]) => buildCampusInviteTask(manualCampusTaskId(market), market))
    .filter(Boolean);
}

function buildCampusInviteTask(id, marketKey) {
  const market = marketOptions[marketKey];
  if (!market) return null;
  const shortName = market.label.replace(/大学$/, "");
  const gate = marketKey === "lion" ? "南门" : marketKey === "deer" ? "北门" : "东门";
  const manual = id.startsWith("manual-campus-");
  return {
    id,
    marketKey,
    campusInvite: true,
    manual,
    banner: "好友申请",
    icon: shortName.slice(0, 1),
    phase: "扩张",
    title: manual ? `${market.label}对接回信` : `${market.label}也想开团`,
    request: {
      from: `${market.label}代取群主`,
      note: `我们这边也想订，能不能每晚送到${gate}？同学在小程序下单，到门口出示截图取。`,
      accept: `我通过了${market.label}代取群主好友申请。`,
      reject: `我拒绝了${market.label}代取，群主在广场平台说我只照顾${homeSchoolName()}。`,
      rejectEffects: { heat: 5, reputation: -4 },
    },
    body: manual
      ? `你主动申请了${market.label}点位，对方群主来确认配送和取餐规则。只要通过好友，这个大学就会进入营业中，需求曲线会明显抬高。`
      : `${market.label}代取群主想把订单拉过去。多一个校区意味着小程序要多一个取餐点，截图核销、保温和投诉都会增加。`,
    phone: {
      title: `${market.label}${gate}烤腿群`,
      messages: [
        [`${shortName}群主`, "叔，我们这边也能开团吗？"],
        [`${shortName}群主`, `同学小程序下单，到${gate}给我看截图取。`],
        [`${shortName}群主`, "不过送晚了他们会直接在广场平台挂人。"],
      ],
    },
    choices: [
      {
        title: "我只接明示品类的预售",
        desc: "扩张慢，但账清楚。",
        cost: "慢慢扩",
        reply: "可以，但小程序必须写清品类和取餐点，先限量预售。",
        effects: { cash: 4, reputation: 6, conscience: 5, documents: 8, risk: -3, heat: 4, margin: 2, cost: 3 },
        log: `${market.label}开了限量预售，新增订单不多，但截图比较干净。`,
      },
      {
        title: "我让群主复制旧小程序页",
        desc: "最快扩张，也最容易复制旧问题。",
        cost: "复制风险",
        reply: `你先复制${homeSchoolName()}这边小程序页，今晚直接收单。`,
        effects: { cash: 16, reputation: -5, conscience: -8, documents: -10, risk: 12, heat: 12, margin: 8 },
        log: `${market.label}订单冲上来，旧小程序页面里的含糊写法也一起扩散。`,
      },
      {
        title: "我只做小规模试营业",
        desc: "先营业但限量，少赚一些，压力可控。",
        cost: "试营业",
        reply: "可以先开，但每天限量，等我把供货和标签理顺再放量。",
        effects: { cash: 2, reputation: 4, conscience: 4, risk: -2, heat: 2, margin: -1 },
        log: `${market.label}进入小规模试营业，需求曲线抬高了一截，但你没有一次性放开。`,
      },
    ],
  };
}

function scheduledStoryIds() {
  const summary = getMetricSummary();
  const dayKey = String(state.calendarDay);
  const locked = state.dailyStoryKeys?.[dayKey];
  if (locked && storyTaskById(locked)) return [locked];

  let id = null;
  const secondCampus = selectedUniversityMarkets()[1];
  if (
    state.calendarDay >= 7 &&
    secondCampus &&
    !state.markets[secondCampus] &&
    !state.completed["campus-invite-2"] &&
    state.requests["campus-invite-2"] !== "rejected"
  ) {
    id = "campus-invite-2";
  }
  const availableStoryIds = allStoryTasks()
    .filter((item) => !(item.campusInvite && state.markets[item.marketKey]))
    .map((item) => item.id);
  if (!id) id = selectStoryId(state, summary, availableStoryIds);
  state.dailyStoryKeys ||= {};
  if (id) state.dailyStoryKeys[dayKey] = id;
  return id ? [id] : [];
}

function scheduledStoryTasks() {
  return scheduledStoryIds().map(storyTaskById).filter(Boolean);
}

function storyTriggerReason(item) {
  return storyReasonForItem(state, getMetricSummary(), item);
}

function day() {
  syncDayIndex();
  return chapters[state.dayIndex];
}

function task() {
  return chapterTasks()[state.activeTask];
}

function taskKey(taskId) {
  return taskId;
}

function chapterStartDay(index) {
  return [1, 6, 9][index] || 1;
}

function chapterSpanDays(index = state.dayIndex) {
  return [5, 3, 7][index] || 1;
}

function chapterElapsedMinutes() {
  const chapterDay = Math.max(0, state.calendarDay - chapterStartDay(state.dayIndex));
  return chapterDay * (dayEnd - dayStart) + Math.max(0, state.minute - dayStart);
}

function gameElapsedMinutes() {
  return (state.calendarDay - 1) * (dayEnd - dayStart) + Math.max(0, state.minute - dayStart);
}

function taskDueOffset(index) {
  if (index === 0) return 45;
  const taskCount = Math.max(1, chapterTasks().length);
  const dayWindow = dayEnd - dayStart;
  const usableWindow = Math.max(240, dayWindow - 180);
  const spacing = Math.floor(usableWindow / Math.max(2, taskCount));
  return Math.min(dayWindow - 75, 60 + index * spacing);
}

function taskDueLabel(index) {
  const offset = taskDueOffset(index);
  const dayOffset = Math.floor(offset / (dayEnd - dayStart));
  const minuteInDay = dayStart + (offset % (dayEnd - dayStart));
  const absoluteDay = chapterStartDay(state.dayIndex) + dayOffset;
  return absoluteDay === state.calendarDay
    ? `${formatTime(minuteInDay)} 截止`
    : `第 ${absoluteDay} 天 ${formatTime(minuteInDay)} 截止`;
}

function syncDayIndex() {
  if (state.calendarDay >= 9) {
    state.dayIndex = 2;
  } else if (state.calendarDay >= 6) {
    state.dayIndex = 1;
  } else {
    state.dayIndex = 0;
  }
}

function requestStatus(item) {
  if (!item.request) return "accepted";
  return state.requests[taskKey(item.id)] || "pending";
}

function chatTitleForTask(item) {
  return formatText(item.request && requestStatus(item) === "pending" ? item.request.from : item.phone.title);
}

function latestMessageText(title) {
  const messages = state.chatHistory[title] || [];
  return messages.length ? messages[messages.length - 1].text : "";
}

function chatMessageCount(title, fallbackMessages = []) {
  const messages = state.chatHistory[title]?.length
    ? state.chatHistory[title]
    : fallbackMessages.map(([who, text]) => ({ who: normalizeSpeaker(who), text }));
  return messages.length;
}

function rememberChat(title, details = {}) {
  if (!title) return;
  const formattedTitle = formatText(title);
  const formattedDetails = {
    ...details,
    last: details.last ? formatText(details.last) : details.last,
  };
  if (!state.knownChats[formattedTitle]) {
    state.knownChats[formattedTitle] = {
      title: formattedTitle,
      unread: 0,
      last: "",
      kind: formattedDetails.kind || "chat",
    };
    state.chatOrder.unshift(formattedTitle);
  }

  state.knownChats[formattedTitle] = {
    ...state.knownChats[formattedTitle],
    ...formattedDetails,
    title: formattedTitle,
    last: formattedDetails.last || latestMessageText(formattedTitle) || state.knownChats[formattedTitle].last || "",
  };
}

function pinChat(title) {
  if (!title) return;
  state.chatOrder = [title, ...state.chatOrder.filter((item) => item !== title)];
}

function forgetChat(title) {
  delete state.knownChats[title];
  state.chatOrder = state.chatOrder.filter((item) => item !== title);
}

function rememberTaskChat(item) {
  const title = chatTitleForTask(item);
  const pending = item.request && requestStatus(item) === "pending";
  rememberChat(title, {
    unread: pending ? 1 : chatMessageCount(item.phone.title, item.phone.messages),
    last: pending ? formatText(item.request.note) : latestMessageText(title) || formatText(item.phone.messages.at(-1)?.[1] || ""),
    kind: pending ? "request" : "chat",
  });
}

function findTaskIndexForChat(title) {
  const formattedTitle = formatText(title);
  const tasks = chapterTasks();
  const pendingIndex = tasks.findIndex(
    (item, index) => isUnlocked(index) && chatTitleForTask(item) === formattedTitle && !isDone(item),
  );
  if (pendingIndex >= 0) return pendingIndex;

  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    if (isUnlocked(index) && chatTitleForTask(tasks[index]) === formattedTitle) return index;
  }

  return -1;
}

function appendChatMessages(title, messages) {
  const formattedTitle = formatText(title);
  state.chatHistory[formattedTitle] ||= [];
  state.chatHistory[formattedTitle].push(...messages.map(([who, text]) => ({ who: formatText(normalizeSpeaker(who)), text: formatText(text) })));
  rememberChat(formattedTitle, { last: latestMessageText(formattedTitle) });
  pinChat(formattedTitle);
}

function normalizeSpeaker(who) {
  return who === "鸭腿叔叔" ? "我" : who;
}

function isOwnSpeaker(who) {
  return who === "我" || who === uncleGroupNick;
}

function replySpeakerForChat(title) {
  return title.includes("群") ? uncleGroupNick : "我";
}

function ensureTaskMessages(item) {
  if (requestStatus(item) === "pending") return;
  const key = taskKey(item.id);
  const title = chatTitleForTask(item);
  if (!state.injectedMessages[key]) {
    state.injectedMessages[key] = true;
    appendChatMessages(title, item.phone.messages);
  }
  rememberTaskChat(item);
}

function dueMinute(index) {
  const offset = taskDueOffset(index);
  return dayStart + (offset % (dayEnd - dayStart));
}

function formatTime(minute) {
  const wholeMinute = Math.floor(minute);
  const hours = Math.floor(wholeMinute / 60);
  const minutes = wholeMinute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isDone(item) {
  return Boolean(state.completed[taskKey(item.id)]);
}

function isOverdue(item, index) {
  return !isDone(item) && chapterElapsedMinutes() > taskDueOffset(index);
}

function isUnlocked(index) {
  const item = chapterTasks()[index];
  return index === 0 || item?.manual || chapterElapsedMinutes() >= taskDueOffset(index) - 60;
}

function visibleTasks() {
  return chapterTasks().filter((_, index) => isUnlocked(index));
}

function visiblePendingTasks() {
  return chapterTasks().filter((item, index) => isUnlocked(index) && !isDone(item));
}

function effectiveSpeed() {
  if (state.speed === 0) return 0;
  return visiblePendingTasks().length ? state.speed : state.speed * 6;
}

function applyOperatingGrowth(elapsedMinutes = tickMinutes) {
  if (!state.started || state.ended) return;
  const snapshot = operatingSnapshot(state);
  if (snapshot.cashPerMinute) {
    state.cash = Math.max(0, state.cash + snapshot.cashPerMinute * elapsedMinutes);
  }
  state.paidTraffic = clamp(state.paidTraffic - 0.01, 0, 100);
}

function processMarketRequests() {
  Object.entries(state.marketRequestDue).forEach(([market, due]) => {
    if (state.marketContacts[market] !== "requested") return;
    if (gameElapsedMinutes() < due) return;
    state.marketContacts[market] = "ready";
    delete state.marketRequestDue[market];
    if (isUniversityMarket(market)) {
      state.manualCampusRequests ||= {};
      state.manualCampusRequests[market] = "pending";
    }
    const text = isUniversityMarket(market)
      ? `${marketDisplayOption(market).label} 通过了好友申请，对接聊天已置顶。`
      : `${marketDisplayOption(market).label} 通过了好友申请，可以解锁营业。`;
    state.log.unshift(text);
    state.log = state.log.slice(0, 12);
    pushHistory(text);
    showTicker(text);
  });
}

function chargeEndOfDayCosts() {
  const key = String(state.calendarDay);
  if (state.dayCostsCharged[key]) return;
  state.dayCostsCharged[key] = true;
  const snapshot = operatingSnapshot(state);
  applyImmediateEffects({
    heat: snapshot.dailyHeat,
    risk: snapshot.dailyRisk,
    reputation: snapshot.dailyReputation,
    documents: snapshot.dailyDocuments,
    conscience: snapshot.dailyConscience,
  });
  const cashDelta = Math.round(state.cash - (state.dayStartCash ?? initialState.cash));
  state.log.unshift(`今日经营变化：${cashDelta >= 0 ? "+" : ""}${cashDelta} ${currencyName}，风险 ${snapshot.dailyRisk >= 0 ? "+" : ""}${snapshot.dailyRisk}`);
  state.log = state.log.slice(0, 12);
}

function recordDailyReport() {
  if (state.dayReports.some((report) => report.day === state.calendarDay)) return;
  const snapshot = operatingSnapshot(state);
  const summary = getMetricSummary();
  const cashDelta = Math.round(state.cash - (state.dayStartCash ?? initialState.cash));
  const report = {
    day: state.calendarDay,
    cashDelta,
    sales: Math.round(snapshot.dailySales),
    risk: summary.risk,
    traffic: summary.traffic,
    suspended: snapshot.suspended,
  };
  state.dayReports.push(report);
  state.dayReports = state.dayReports.slice(-survivalDays);

  const sign = cashDelta >= 0 ? "+" : "";
  const text = `第 ${report.day} 天经营记录：${sign}${cashDelta} ${currencyName}，卖出 ${report.sales} 份，风险 ${report.risk}，流量 ${report.traffic}`;
  state.log.unshift(text);
  state.log = state.log.slice(0, 12);
  pushHistory(text);
}

function pushHistory(text) {
  state.history.unshift(`${formatTime(Math.min(state.minute, dayEnd))} ${text}`);
  state.history = state.history.slice(0, 30);
}

function showTicker(text) {
  state.tickerText = text;
  state.tickerUntil = gameElapsedMinutes() + 120;
}

function isTickerActive() {
  return Boolean(state.tickerText && gameElapsedMinutes() <= state.tickerUntil);
}

function isControlUnlockTickerActive() {
  return isTickerActive() && /^新模块解锁/.test(state.tickerText) && state.activeMainTab !== "control";
}

function featureUnlockLabel(unlockDay) {
  const labels = {
    2: "声量、政策、货源",
    3: "区域扩张",
    4: "今日预估、路线倾向",
  };
  return labels[unlockDay] || "";
}

function notifyFeatureUnlocks() {
  [2, 3, 4].forEach((unlockDay) => {
    if (state.calendarDay < unlockDay || state.seenFeatureUnlocks[unlockDay]) return;
    const label = featureUnlockLabel(unlockDay);
    if (!label) return;
    state.seenFeatureUnlocks[unlockDay] = true;
    const text = `新模块解锁：${label}`;
    state.log.unshift(text);
    state.log = state.log.slice(0, 12);
    pushHistory(text);
    showTicker(text);
  });
}

function revealUnlockedEvents() {
  chapterTasks().forEach((item, index) => {
    const key = taskKey(item.id);
    if (!isUnlocked(index)) return;
    rememberTaskChat(item);
    if (state.seenTasks[key]) return;
    state.seenTasks[key] = true;
    pinChat(chatTitleForTask(item));
    const text = `新消息：${formatText(item.banner)}`;
    const reason = storyTriggerReason(item);
    if (reason) {
      state.log.unshift(reason);
      state.log = state.log.slice(0, 12);
    }
    pushHistory(text);
    showTicker(text);
  });
}

function allDone() {
  return chapterTasks().every(isDone);
}

function canAdvanceFromCurrentDay() {
  return visiblePendingTasks().length === 0;
}

function acceptRequest() {
  const active = task();
  if (!active.request) return;
  const requestTitle = chatTitleForTask(active);
  state.requests[taskKey(active.id)] = "accepted";
  if (active.campusInvite && active.marketKey) {
    openUniversityMarket(active.marketKey, active.manual ? "manual" : "incoming");
  }
  forgetChat(requestTitle);
  state.activeChatTitle = chatTitleForTask(active);
  ensureTaskMessages(active);
  rememberTaskChat(active);
  pinChat(state.activeChatTitle);
  const nextIndex = findTaskIndexForChat(state.activeChatTitle);
  if (nextIndex >= 0) state.activeTask = nextIndex;
  pushHistory(formatText(active.request.accept));
  showTicker(formatText(active.request.accept));
  render();
}

function rejectRequest() {
  const active = task();
  if (!active.request) return;
  const key = taskKey(active.id);
  state.requests[key] = "rejected";
  if (active.campusInvite && active.marketKey && active.manual) {
    state.manualCampusRequests ||= {};
    state.manualCampusRequests[active.marketKey] = "rejected";
  }
  state.completed[key] = true;
  state.replies[key] = "我没有通过好友申请。";
  const requestTitle = chatTitleForTask(active);
  appendChatMessages(requestTitle, [[requestTitle, active.request.note], ["我", "暂时不通过。"]]);
  rememberChat(requestTitle, { unread: "已拒绝", kind: "request" });
  applyEffects(active.request.rejectEffects || {});
  scoreRoute("evasion", 2);
  state.log.unshift(formatText(active.request.reject));
  pushHistory(formatText(active.request.reject));
  showTicker(formatText(active.request.reject));
  render();
}

function applyImmediateEffects(effects = {}) {
  Object.entries(effects).forEach(([key, delta]) => {
    if (typeof state[key] !== "number") return;
    state[key] = key === "cash" ? Math.max(0, state[key] + delta) : clamp(state[key] + delta);
  });
}

function normalizeEffects(effects = {}) {
  return Object.fromEntries(
    Object.entries(effects).map(([key, delta]) => {
      if (key === "risk" && delta > 0) return [key, delta * 0.55];
      return [key, delta];
    }),
  );
}

function applyEffects(effects = {}, options = {}) {
  const adjustedEffects = normalizeEffects(effects);
  applyImmediateEffects(adjustedEffects);
}

function drainEffectQueue(elapsedMinutes = tickMinutes) {
  if (!state.effectQueue.length) return;

  state.effectQueue.forEach((entry) => {
    const divisor = Math.max(1, entry.remaining);
    const elapsed = Math.min(elapsedMinutes, entry.remaining);
    Object.entries(entry.effects).forEach(([key, delta]) => {
      if (typeof state[key] !== "number") return;
      const change = delta * (elapsed / divisor);
      state[key] = key === "cash" ? Math.max(0, state[key] + change) : clamp(state[key] + change);
      entry.effects[key] = delta - change;
    });
    entry.remaining -= elapsed;
  });

  state.effectQueue = state.effectQueue.filter((entry) => entry.remaining > 0);
}

function isHonestChoice(choice) {
  const text = `${choice.title} ${choice.reply}`;
  return /鹅腿|原料|票据|停售|退款|道歉|送检|正规合同|暂停营业|公开账本/.test(text);
}

function applyHonestPressure(choice) {
  if (!isHonestChoice(choice)) return;
  state.honestDays += 1;
  applyEffects({ cash: -4, margin: -3, cost: 3, heat: -1 });

  if (/鹅腿/.test(choice.title)) {
    applyEffects({ cash: -6, margin: -5, cost: 8, heat: -3 });
    state.log.unshift("鹅腿成本太高，定价一涨，小程序下单人数明显少了。");
  }
}

function scoreRoute(route, amount = 1) {
  if (!state.routes[route]) state.routes[route] = 0;
  state.routes[route] += amount;
}

function scoreChoiceRoute(choice) {
  const text = `${choice.title} ${choice.desc || ""} ${choice.cost || ""} ${choice.reply || ""} ${choice.log || ""}`;
  routeRules.forEach(([route, amount, pattern]) => {
    if (pattern.test(text)) scoreRoute(route, amount);
  });
}

function setFlag(choice) {
  if (!choice.flag) return;
  const [key, value] = choice.flag;
  state.flags[key] = value;
}

function applyChoiceState(choice) {
  const text = `${choice.title} ${choice.reply || ""} ${choice.log || ""}`;
  if (/主卖鹅腿|只要.*鹅腿|鹅腿实价|鹅腿和完整票据|坚持鹅腿/.test(text)) {
    state.source = "goose";
    state.productFocus = "goose";
  } else if (/主卖鸭腿|改卖鸭腿|鲜鸭腿|鸭腿并明示|稳定鲜鸭腿/.test(text)) {
    state.source = "freshDuck";
    state.productFocus = "duck";
  } else if (/冻鸭|低价鸭边腿|便宜货|冷库/.test(text)) {
    state.source = "frozenDuck";
    state.productFocus = "cheapDuck";
  }
}

function applyNarrativeOperations(choice) {
  const text = `${choice.title} ${choice.desc || ""} ${choice.reply || ""} ${choice.log || ""}`;
  const suspendDays = /停业\s*2\s*日|停业\s*两\s*日|停业\s*2\s*天|停业\s*两\s*天|整顿\s*2\s*日|整顿\s*两\s*天/.test(text)
    ? 2
    : /今天停售|主动停售|暂停营业|停业整顿/.test(text)
      ? 1
      : 0;

  if (suspendDays > 0) {
    state.suspendedUntilDay = Math.max(state.suspendedUntilDay || 0, state.calendarDay + suspendDays - 1);
    state.suspensionReason = suspendDays > 1 ? `停业整顿 ${suspendDays} 天` : "今日停售整顿";
    state.log.unshift(`${state.suspensionReason}：销售收入暂停，摊贩只保留待命成本。`);
  }

  if (/暂停果猫|果猫先暂停/.test(text)) {
    state.marketSuspensions.cbd = Math.max(state.marketSuspensions.cbd || 0, state.calendarDay + 1);
    state.log.unshift("果猫商业区暂停 2 天，商业区需求和监管压力暂时移出今日结算。");
  }

  if (/暂停相关批次|这批先停|送检/.test(text)) {
    applyEffects({ heat: -2, risk: -4, documents: 4 }, { duration: 180 });
    state.log.unshift("相关批次暂停销售，短期少卖，检测和票据让风险缓慢下降。");
  }
}

function checkEarlyEnding() {
  const { bank, risk } = getMetricSummary();

  if (bank <= 0) {
    renderEnding({
      name: "现金断档",
      body:
        "账上已经没有可周转的钱。订单还在响，炉火也还热，但供应商、退款、押金和家用同时压过来，小摊提前收摊。",
    });
    return true;
  }

  if (isRiskFailure({ risk })) {
    renderEnding({
      name: "风险爆表",
      body:
        "总风险越过临界点，监管、投诉和舆论不再是单独事件。聊天记录、订单截图、票据缺口被串成一条线，经营被迫中止。",
    });
    return true;
  }

  return false;
}

function applyOverduePressure() {
  if (state.calendarDay < 9) return;
  chapterTasks().forEach((item, index) => {
    if (!isUnlocked(index)) return;
    if (isDone(item)) return;
    const key = taskKey(item.id);
    const due = taskDueOffset(index);
    const hits = state.overdueHits[key] || 0;
    const nextPenaltyAt = due + hits * 240;

    if (chapterElapsedMinutes() <= nextPenaltyAt) return;

    applyEffects({ reputation: -0.4, conscience: -0.2, documents: -0.35, risk: 0.45, heat: 0.8 });
    state.overdueHits[key] = hits + 1;
    state.log.unshift(`${formatText(item.banner)} 超时未回复，截图和猜测开始自己长腿。`);
    state.log = state.log.slice(0, 12);
  });
}

function applyContinuousPressure() {
  if (state.calendarDay < 9) return;
  if (Math.floor(state.minute) % 45 > tickMinutes) return;

  const pending = chapterTasks().filter((item, index) => isUnlocked(index) && !isDone(item)).length;
  const overdue = chapterTasks().filter((item, index) => isUnlocked(index) && isOverdue(item, index)).length;
  if (!pending) return;

  applyEffects({
    heat: (pending + overdue) * 0.22,
    risk: overdue * 0.08,
    reputation: overdue ? -0.12 : 0,
  });
}

function closeUnansweredTasks() {
  const pending = visiblePendingTasks().length;
  if (!pending) return;
  state.log.unshift(`第 ${state.calendarDay} 天有 ${pending} 个红点没处理，截图和猜测留到了后续经营里。`);
  state.log = state.log.slice(0, 12);
}

function choose(index) {
  if (state.ended) return;
  const active = task();
  if (isDone(active)) return;
  const choice = active.choices[index];

  applyEffects(choice.effects);
  applyHonestPressure(choice);
  applyNarrativeOperations(choice);
  scoreChoiceRoute(choice);
  setFlag(choice);
  applyChoiceState(choice);
  if (active.campusInvite && active.manual && active.marketKey) {
    state.manualCampusRequests ||= {};
    state.manualCampusRequests[active.marketKey] = "completed";
  }
  state.completed[taskKey(active.id)] = true;
  state.replies[taskKey(active.id)] = choice.reply;
  const activeTitle = chatTitleForTask(active);
  appendChatMessages(activeTitle, [[replySpeakerForChat(activeTitle), choice.reply]]);
  rememberTaskChat(active);
  state.log.unshift(formatText(choice.log));
  pushHistory(`我回复了：${formatText(choice.title)}`);
  state.log = state.log.slice(0, 12);

  if (checkEarlyEnding()) return;
  if (state.minute >= dayEnd && canAdvanceFromCurrentDay()) {
    nextDay();
    return;
  }
  render();
}

function nextDay() {
  if (state.ended) return;

  if (state.calendarDay >= survivalDays) {
    renderEnding(pickSurvivalEnding());
    return;
  }

  state.calendarDay += 1;
  syncDayIndex();
  state.activeTask = 0;
  state.activeChatTitle = "";
  state.minute = dayStart;
  if (state.autoPausedForPending) state.speed = 1;
  state.autoPausedForPending = false;
  state.dayStartCash = state.cash;
  pushHistory(`剧情推进到第 ${state.calendarDay} 天`);
  render();
}

function pickSurvivalEnding() {
  const summary = getMetricSummary();
  const reports = state.dayReports || [];
  const averageCashDelta = reports.length
    ? Math.round(reports.reduce((sum, report) => sum + report.cashDelta, 0) / reports.length)
    : 0;
  const expanded = state.markets.frog || state.markets.cbd;
  const route = dominantRoute().route;

  if (isStableSuccess(state, summary)) {
    if (routeScore("compliance") >= 8 && summary.risk < 45 && state.documents >= 80) {
      return {
        name: "明账长摊",
        route: "compliance",
        body:
          `你撑过了 ${survivalDays} 天，也把原料、票据、菜单和取餐规则做成了明账。队伍没有最大，但信任最硬，小摊有了长期经营的样子。`,
      };
    }

    if (expanded && summary.bank >= 4000 && summary.risk < 60) {
      return {
        name: "多点稳开",
        route,
        body:
          `你把白鲸大学之外的点位也接住了。扩张没有只靠热度硬推，而是靠员工、价格、供货和票据一起兜住。`,
      };
    }

    return {
      name: "半月稳摊",
      route,
      body:
        `你把小摊撑过了 ${survivalDays} 天。钱不是每天最多，但价格、货源、员工和风险终于能互相解释，生意从一阵热闹变成了一门能复盘的买卖。`,
    };
  }

  if (summary.bank >= 6000 && summary.risk >= 70) {
    return {
      name: "黑红滚钱",
      route,
      body:
        "账上数字很好看，群里也还热闹，但风险和票据缺口已经贴着红线。你不是没赢，只是把下一次爆雷留给了明天。",
    };
  }

  if (routeScore("pr") >= 5 || routeScore("evasion") >= 6) {
    return {
      name: "话术余温",
      route,
      body:
        "你靠解释、公关和拖延撑到了第十五天。摊位没有立刻倒下，但大家记住的不是味道，而是每一张被转发的截图。",
    };
  }

  if (summary.bank < 500 || averageCashDelta < 60) {
    return {
      name: "现金贴地",
      route,
      body:
        "你没有破产，但每天都在贴着现金线走。价格、员工和供货只要再错一次，下一轮就很难继续周转。",
    };
  }

  if (summary.risk >= 75) {
    return {
      name: "红线边缘",
      route,
      body:
        "你撑过了十五天，但风险已经压到门口。再多一次含糊供货、迟到投诉或价格质疑，就可能直接越过红线。",
    };
  }

  return {
    name: "险中过月",
    route,
    body:
      `你撑过了 ${survivalDays} 天，但账面和风险都不轻松。小摊还没倒，下一步要做的不是继续冲量，而是把最容易出事的环节彻底收紧。`,
  };
}

function tick() {
  if (state.ended || !state.started || state.speed === 0) return;

  const pendingBefore = visiblePendingTasks().map((item) => taskKey(item.id)).join("|");
  const dayBefore = state.calendarDay;
  state.tickCarry += effectiveSpeed();
  const steps = Math.floor(state.tickCarry);
  state.tickCarry -= steps;

  for (let i = 0; i < steps; i += 1) {
    if (state.ended || state.minute >= dayEnd) break;
    state.minute += tickMinutes;
    drainEffectQueue();
    processMarketRequests();
    applyOperatingGrowth(tickMinutes);
    applyContinuousPressure();
    applyOverduePressure();
  }

  const pendingAfter = visiblePendingTasks().map((item) => taskKey(item.id)).join("|");

  if (checkEarlyEnding()) return;

  if (state.minute >= dayEnd) {
    chargeEndOfDayCosts();
    if (checkEarlyEnding()) return;

    recordDailyReport();
    if (!canAdvanceFromCurrentDay()) {
      closeUnansweredTasks();
      state.autoPausedForPending = true;
      state.speed = 0;
      showTicker("先处理未回复消息，处理完会进入下一天。");
      render();
      return;
    }

    render();
    nextDay();
    return;
  }

  if (pendingBefore !== pendingAfter || dayBefore !== state.calendarDay) {
    render();
    return;
  }

  renderProgress();
  renderMetrics();
  renderStallScene();
  renderOperatingPanels();
  saveGame(true);
}

function routeScore(route) {
  return state.routes[route] || 0;
}

function routeRankings() {
  return Object.entries(routeDetails)
    .map(([route, [label, desc]]) => ({
      route,
      label,
      desc,
      score: routeScore(route),
    }))
    .sort((a, b) => b.score - a.score);
}

function dominantRoute() {
  const [top] = routeRankings();
  return top || { route: "compliance", score: 0, label: "未定路线" };
}

function pickFinalEnding() {
  const route = dominantRoute();

  if (state.cash <= 10 && state.honestDays >= 5 && state.risk < 45) {
    return {
      name: "诚信破产",
      route: "compliance",
      body:
        "我一直按真货、真票、真价格做，但队伍变短，成本变高，家用和退款压到最后。摊子没有塌房，只是安静地撑不下去了。",
    };
  }

  if (routeScore("restart") >= 2 && (routeScore("evasion") >= 4 || routeScore("pr") >= 2 || state.conscience < 45)) {
    return {
      name: "异地重启",
      route: "restart",
      body:
        "旧群聊、旧截图和旧订单被留在原地，新账号重新点火。菜单看起来换了，话术却很熟，第一批新顾客还不知道上一座城市发生过什么。",
    };
  }

  if (routeScore("pr") >= 4 && (state.flags.prAgency || state.heat > 60)) {
    return {
      name: "公关接管",
      route: "pr",
      body:
        "回应、菜单和短视频都交给了公关口径。热度没有立刻熄灭，但每一次解释都先问传播效果，再问原料和票据。",
    };
  }

  if (routeScore("hype") >= 6 && state.heat > 60) {
    return {
      name: "黑红续命",
      route: "hype",
      body:
        "免费、低价、直播和争议把队伍继续推长。钱和流量还在进来，但每一单都像新的素材，等着下一次被剪成证据。",
    };
  }

  if (routeScore("compliance") >= 8 && routeScore("goodwill") >= 2 && state.risk < 55) {
    return {
      name: "重新写菜单",
      route: "compliance",
      body:
        "你用退款、道歉、送检和明示菜单把生意从人设里拆出来。队伍短了，价格硬了，但顾客终于不用靠猜来理解自己买的是什么。",
    };
  }

  if (routeScore("compliance") >= 8 && routeScore("contraction") >= 3 && state.cash > 18 && state.risk < 55) {
    return {
      name: "小摊长久",
      route: "compliance",
      body:
        "我没有再靠含糊的招牌冲销量。鹅腿贵，就少卖；鸭腿能卖，就明说。生意没有以前热闹，但每天都能把账说清楚。",
    };
  }

  if (routeScore("contraction") >= 5 && state.risk < 58) {
    return {
      name: "只卖得动的晚上",
      route: "contraction",
      body:
        "你砍掉跨区、限量预售，把摊位重新缩回自己能看住的范围。现金没有大爆发，但晚高峰之后，账本和炉火都还在可控范围内。",
    };
  }

  if (routeScore("evasion") >= 7 || (routeScore("evasion") >= 5 && state.risk > 60)) {
    return {
      name: "证据回旋镖",
      route: "evasion",
      body:
        "你争取到了一些时间，也留下了更多空白。小字备注、撤回提示、拒绝回应和甩锅截图被重新拼起来，最后比一句直接说明更难解释。",
    };
  }

  if (routeScore("goodwill") >= 4 && state.conscience > 50 && state.risk < 60) {
    return {
      name: "退券慢修",
      route: "goodwill",
      body:
        "补券和退款没能立刻洗掉质疑，却给了顾客一个明确出口。摊位恢复得很慢，但争议不再只靠情绪往前滚。",
    };
  }

  if (state.honestDays >= 7 && state.cash > 28 && state.risk < 42 && state.documents > 68) {
    return {
      name: "小摊长久",
      route: "compliance",
      body:
        "我没有再靠含糊的招牌冲销量。鹅腿贵，就少卖；鸭腿能卖，就明说。生意没有以前热闹，但每天都能把账说清楚。",
    };
  }

  if (state.documents > 74 && state.conscience > 58) {
    return {
      name: "明码标腿",
      route: "compliance",
      body:
        "招牌少了传奇，多了原料、克重、批次和退款规则。生意变小以后，终于没人需要替你脑补诚信。",
    };
  }

  if (state.risk > 72) {
    return {
      name: "热榜里的样本",
      route: route.route,
      body:
        "你成了食品标识案例里最热闹的一页。每个人都说自己早看出来了，但当初转发排队视频的人一个也不少。",
    };
  }

  if (state.flags.studentRefund && state.conscience > 62 && state.risk < 45) {
    return {
      name: "重新写菜单",
      route: "goodwill",
      body:
        "你付出了退款和停业的代价，换来一张能说清楚的菜单。队伍没有以前长，但买卖终于回到买卖本身。",
    };
  }

  if (state.cash > 72 && state.conscience < 38) {
    return {
      name: "流量批发商",
      route: "hype",
      body:
        "钱留住了，人设也换了个壳。你不再纠结卖的是什么腿，因为镜头只需要热气、笑脸和一个能传播的标题。",
    };
  }

  if (state.reputation < 30) {
    return {
      name: "群聊黑名单",
      route: route.route,
      body:
        "学生群把你移出小程序团购，退款表比订购表更长。烟火气没有消失，只是大家终于学会先看标签。",
    };
  }

  if (state.heat > 75) {
    return {
      name: "永不下播",
      route: "hype",
      body:
        "你没有解决问题，只是把问题直播化。每一次澄清都像预告片，每一次道歉都带着小黄车。",
    };
  }

  return {
    name: "摊灯半明",
    route: route.route,
    body:
      "你没有彻底翻车，也没有真正翻身。几天之后，摊车还在路口，招牌上的每个字都比以前重了一点。",
  };
}

function renderStats() {
  const summary = getMetricSummary();
  const groups = [
    ["存款", summary.bank, metricDetails.profitDetails],
    ["风险", summary.risk, metricDetails.riskDetails],
    ["流量", summary.traffic, metricDetails.trafficDetails],
  ];

  document.querySelector("#stats").innerHTML = groups
    .map(([title, total, rows]) => {
      const details = rows
        .map(([label, key, inverse]) => {
          const value = inverse ? 100 - state[key] : state[key];
          return `<div class="stat-subrow"><span>${label}</span><strong>${clamp(Math.round(value))}</strong></div>`;
        })
        .join("");

      return `
        <div class="stat-group">
          <div class="stat-row">
            <span>${title}</span>
            <strong>${title === "存款" ? `${total} ${currencyName}` : total}</strong>
          </div>
          ${
            title === "存款"
              ? ""
              : `<div class="meter ${title === "风险" ? "risk" : "heat"}">
                  <span style="width: ${total}%"></span>
                </div>`
          }
          <div class="stat-breakdown">${details}</div>
        </div>
      `;
    })
    .join("");
}

function renderMetrics() {
  const { bank, risk, traffic } = getMetricSummary();
  const snapshot = operatingSnapshot(state);

  document.querySelector("#bankValue").textContent = `${bank} ${currencyName}`;
  document.querySelector("#dailyIncomeValue").textContent = `${Math.round(snapshot.dailyGrossProfit)} ${currencyName}/天`;
  document.querySelector("#riskValue").style.width = `${risk}%`;
  document.querySelector("#riskValue").dataset.value = `${risk}%`;
  document.querySelector("#riskValue").parentElement.setAttribute("aria-label", `风险 ${risk}%`);
  document.querySelector("#trafficValue").style.width = `${traffic}%`;
  document.querySelector("#trafficValue").dataset.value = `${traffic}%`;
  document.querySelector("#trafficValue").parentElement.setAttribute("aria-label", `流量 ${traffic}%`);

  Object.entries(metricDetails).forEach(([id, rows]) => {
    const container = document.querySelector(`#${id}`);
    if (!container) return;
    container.innerHTML = rows
      .map(([label, key, inverse]) => {
        const value = inverse ? 100 - state[key] : state[key];
        return `
          <div>
            <span>${label}</span>
            <strong class="mini-meter"><i style="width: ${clamp(Math.round(value))}%"></i></strong>
          </div>
        `;
      })
      .join("");
  });
}

function renderStallScene() {
  const scene = $("#stallScene");
  if (!scene) return;
  const snapshot = operatingSnapshot(state);
  const { risk, traffic } = getMetricSummary();
  const classes = ["stall-scene"];
  let title = "摊位正常营业";
  let text = `预计卖出 ${Math.round(snapshot.dailySales)} 份，日收益 ${Math.round(snapshot.dailyGrossProfit)} ${currencyName}`;

  if (state.speed === 0) {
    classes.push("paused");
    title = "暂停中";
    text = "时间暂停，适合先看消息再调整经营。";
  } else if (snapshot.suspended) {
    classes.push("suspended", "warning");
    title = "停业整顿中";
    text = "今天不卖货，风险和热度会慢慢回落。";
  } else {
    if (traffic >= 58) classes.push("busy");
    if (traffic >= 72) classes.push("hot");
    if (risk >= 78 || snapshot.dailyGrossProfit < 0) classes.push("danger");
    else if (risk >= 60 || snapshot.overloadRatio > 0.35) classes.push("warning");

    if (snapshot.dailyGrossProfit < 0) {
      title = "现金正在流失";
      text = "当前配置为负日收益，需要降成本或调价格。";
    } else if (risk >= 78) {
      title = "风险压过收益";
      text = "继续冲量会更快接近停摆。";
    } else if (snapshot.overloadRatio > 0.35) {
      title = "排队超过产能";
      text = "订单多，但核销和出餐容易出错。";
    } else if (traffic >= 58) {
      title = "摊前人气升高";
      text = `流量 ${traffic}，要看产能和风险是否跟得上。`;
    }
  }

  scene.className = classes.join(" ");
  $("#stallSceneTitle").textContent = title;
  $("#stallSceneText").textContent = text;
}

function renderBanners() {
  const list = document.querySelector("#taskBanners");
  const titles = state.chatOrder.filter((title) => state.knownChats[title]);

  list.innerHTML = titles.length
    ? titles
        .map((title) => {
          const info = state.knownChats[title];
          const taskIndex = findTaskIndexForChat(title);
          const item = taskIndex >= 0 ? chapterTasks()[taskIndex] : null;
          const pending = item && !isDone(item);
          const overdue = item && isOverdue(item, taskIndex);
          const active = title === state.activeChatTitle;
          const unread = pending ? info.unread : info.unread === "已拒绝" ? "已拒绝" : "已读";
          const displayTitle = formatText(title);
          const last = formatText(info.last || "暂无消息");
          const avatarClass = info.kind === "request" ? "avatar-blue" : `avatar-${avatarTone(title)}`;
          return `
            <button class="chat-list-item ${active ? "active" : ""} ${overdue ? "overdue" : ""}" type="button" data-chat="${title}">
              <div class="avatar ${avatarClass}" aria-hidden="true"><span></span></div>
              <span class="chat-list-copy">
                <strong>${displayTitle}</strong>
                <small>${last}</small>
              </span>
              <span class="chat-list-meta">
                <small>${item ? taskDueLabel(taskIndex) : ""}</small>
                ${pending ? `<b>${unread}</b>` : `<em>${unread}</em>`}
              </span>
            </button>
          `;
        })
        .join("")
    : `
      <div class="empty-chat-list">
        <strong>还没有会话</strong>
        <span>开始营业后，新群聊和好友申请会出现在这里。</span>
      </div>
    `;

  document.querySelectorAll("[data-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeChatTitle = button.dataset.chat;
      const index = findTaskIndexForChat(state.activeChatTitle);
      if (index >= 0) state.activeTask = index;
      render();
    });
  });
}

function renderStoredChat(title) {
  const messages = state.chatHistory[title] || [];
  document.querySelector("#phoneTitle").textContent = formatText(title);
  document.querySelector("#unreadBadge").textContent = state.knownChats[title]?.unread || "已读";
  document.querySelector("#messages").innerHTML = messages.length
    ? messages
        .map(({ who, text }) => {
          const displayWho = formatText(who);
          const displayText = formatText(text);
          const me = isOwnSpeaker(displayWho);
          const avatarClass = me ? "avatar-me" : `avatar-${avatarTone(displayWho)}`;
          return `
            <div class="message-row ${me ? "me" : ""}">
              <div class="avatar ${avatarClass}" aria-hidden="true">
                <span></span>
              </div>
              <div class="bubble-wrap">
                <span class="who">${displayWho}</span>
                <div class="message-bubble">${displayText}</div>
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <div class="empty-conversation">
        <strong>没有更多聊天记录</strong>
        <span>这个会话目前没有需要我处理的消息。</span>
      </div>
    `;
  scrollMessagesToBottom();
}

function renderInactiveChoices(title) {
  document.querySelector("#phaseTag").textContent = "会话";
  document.querySelector("#eventTitle").textContent = formatText(title);
  document.querySelector("#eventBody").textContent = "";
  document.querySelector("#choices").innerHTML = `
    <div class="handled-box">
      <strong>暂无待回复</strong>
      <span>返回聊天列表，处理带红点的会话。</span>
    </div>
  `;
}

function renderConversation(active) {
  const title = state.activeChatTitle || chatTitleForTask(active);
  const taskIndex = findTaskIndexForChat(title);

  if (taskIndex >= 0) {
    state.activeTask = taskIndex;
    const current = chapterTasks()[taskIndex];
    document.querySelector("#phaseTag").textContent = formatText(current.phase);
    document.querySelector("#eventTitle").textContent = formatText(current.title);
    document.querySelector("#eventBody").textContent = "";
    renderMessages(current);
    renderChoices(current);
    return;
  }

  renderStoredChat(title);
  renderInactiveChoices(title);
}

function renderMessages(active) {
  if (requestStatus(active) === "pending") {
    document.querySelector("#phoneTitle").textContent = formatText(active.request.from);
    document.querySelector("#unreadBadge").textContent = "1";
    document.querySelector("#messages").innerHTML = `
      <div class="friend-request">
        <div class="avatar avatar-blue" aria-hidden="true"><span></span></div>
        <strong>${formatText(active.request.from)}</strong>
        <p>${formatText(active.request.note)}</p>
      </div>
    `;
    scrollMessagesToBottom();
    return;
  }

  ensureTaskMessages(active);
  const title = chatTitleForTask(active);
  const messages = state.chatHistory[title] || [];

  document.querySelector("#phoneTitle").textContent = title;
  document.querySelector("#unreadBadge").textContent = isDone(active)
    ? "已读"
    : chatMessageCount(active.phone.title, active.phone.messages);
  document.querySelector("#messages").innerHTML = messages
    .map(({ who, text }) => {
      const displayWho = formatText(who);
      const displayText = formatText(text);
      const me = isOwnSpeaker(displayWho);
      const avatarClass = me ? "avatar-me" : `avatar-${avatarTone(displayWho)}`;
      return `
        <div class="message-row ${me ? "me" : ""}">
          <div class="avatar ${avatarClass}" aria-hidden="true">
            <span></span>
          </div>
          <div class="bubble-wrap">
            <span class="who">${displayWho}</span>
            <div class="message-bubble">${displayText}</div>
          </div>
        </div>
      `;
    })
    .join("");
  scrollMessagesToBottom();
}

function scrollMessagesToBottom() {
  const messages = document.querySelector("#messages");
  if (!messages) return;
  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });
}

function avatarTone(name) {
  const tones = ["green", "amber", "blue", "red", "gray"];
  let total = 0;
  for (const char of name) total += char.charCodeAt(0);
  return tones[total % tones.length];
}

function renderChoices(active) {
  if (requestStatus(active) === "pending") {
    document.querySelector("#choices").innerHTML = `
      <button class="choice-button" type="button" id="acceptRequestButton">
        <span>
          <span class="choice-title">我通过好友申请</span>
          <span class="choice-desc">对方会进入聊天，我可以直接回应。</span>
        </span>
        <span class="choice-cost">打开对话</span>
      </button>
      <button class="choice-button" type="button" id="rejectRequestButton">
        <span>
          <span class="choice-title">我先不通过</span>
          <span class="choice-desc">事情不会消失，只会从别的地方找上门。</span>
        </span>
        <span class="choice-cost">留下隐患</span>
      </button>
    `;
    document.querySelector("#acceptRequestButton").addEventListener("click", acceptRequest);
    document.querySelector("#rejectRequestButton").addEventListener("click", rejectRequest);
    return;
  }

  const done = isDone(active);
  document.querySelector("#choices").innerHTML = done
    ? `
      <div class="handled-box">
        <strong>已处理</strong>
        <span>这个红点已经消掉了。打开其他 banner 继续处理今天的待办。</span>
      </div>
    `
    : active.choices
        .map(
          (choice, index) => `
            <button class="choice-button" type="button" data-choice="${index}">
              <span>
                <span class="choice-title">${formatText(choice.title)}</span>
                <span class="choice-desc">${formatText(choice.desc)}</span>
              </span>
              <span class="choice-cost">${formatText(choice.cost)}</span>
            </button>
          `,
        )
        .join("");

  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => choose(Number(button.dataset.choice)));
  });
}

function renderLog() {
  const entries = state.log.length ? state.log : ["摊车刚支起来，账本还是空的。"];
  document.querySelector("#logList").innerHTML = entries.map((item) => `<li>${item}</li>`).join("");
}

function renderHistory() {
  const entries = state.history.length ? state.history : ["还没有历史事件。"];
  $("#historyList").innerHTML = entries.map((item) => `<li>${item}</li>`).join("");
}

function renderRoutePanel() {
  const rows = routeRankings();
  const top = rows[0];
  const maxScore = Math.max(1, ...rows.map((item) => item.score));
  const ranked = rows
    .filter((item) => item.score > 0)
    .slice(0, 4);

  $("#routePanel").innerHTML = `
    <div class="route-lead">
      <strong>${top.score ? top.label : "路线未定"}</strong>
      <span>${top.score ? top.desc : "还没做出足够多关键选择，路线会随着回复逐渐成形。"}</span>
    </div>
    ${
      ranked.length
        ? ranked
            .map(
              ({ label, score }) => `
                <div class="route-row">
                  <span>${label}</span>
                  <div class="route-track"><span style="width: ${(score / maxScore) * 100}%"></span></div>
                  <strong>${score}</strong>
                </div>
              `,
            )
            .join("")
        : ""
    }
  `;
}

function renderPricingPanel() {
  const input = $("#priceInput");
  const snapshot = operatingSnapshot(state);
  if (input && Number(input.value) !== state.price) input.value = state.price;
  $("#priceLabel").textContent = `${state.price} ${currencyName}`;
  $("#priceHint").textContent = snapshot.suspended
    ? `${state.suspensionReason || "停业整顿"}中，今日预计销量为 0，只保留摊贩待命成本。`
    : `单份毛利约 ${snapshot.unitMargin.toFixed(1)} ${currencyName}，今日预计卖出 ${Math.round(snapshot.dailySales)} 份。` +
      (snapshot.priceRisk > 0 ? ` 当前售价明显高于参考价，价格质疑会带来 +${Math.round(snapshot.priceRisk)} 风险。` : "") +
      (snapshot.overloadRatio > 0 ? ` 潜在订单超过产能 ${Math.round(snapshot.overloadRatio * 100)}%，履约风险会上升。` : "") +
      (snapshot.unitMargin < 0 ? " 当前价格低于成本，卖得越多现金越紧。" : "");
}

function buildDiagnosis(snapshot) {
  const summary = getMetricSummary();
  const activeMarkets = Object.entries(state.markets).filter(([, active]) => active).length;
  const reasons = [];
  let tone = "good";
  let title = "经营节奏稳定";
  let badge = "可持续";

  if (snapshot.suspended) {
    return {
      tone: "warning",
      title: "停业整顿中",
      badge: "无销售",
      reasons: ["今天销量为 0，只保留摊贩待命成本。", "风险和热度会缓慢回落，适合补票据和公告。"],
    };
  }

  if (snapshot.dailyGrossProfit < 0) {
    tone = "danger";
    title = "卖得越多越紧";
    badge = "亏损";
    reasons.push("当前日收益为负，价格、货源或摊贩规模需要立刻调整。");
  } else if (summary.risk >= 78) {
    tone = "danger";
    title = "收益被风险盖住";
    badge = "高风险";
    reasons.push("风险过高会压低需求，并更容易触发失败结局。");
  } else if (snapshot.overloadRatio > 0.45) {
    tone = "warning";
    title = "订单超过产能";
    badge = "易出错";
    reasons.push(`潜在订单超出产能 ${Math.round(snapshot.overloadRatio * 100)}%，迟到和串单风险会上升。`);
  } else if (snapshot.complianceGap > 0.18) {
    tone = "warning";
    title = "合规缺口偏大";
    badge = "需补账";
    reasons.push("商品说明、票据或货源证明跟不上当前市场要求。");
  } else if (activeMarkets > state.staff) {
    tone = "warning";
    title = "区域比人手更快";
    badge = "扩张压力";
    reasons.push("经营区域多于摊贩人数，配送和核销会消耗效率。");
  }

  if (reasons.length < 2) {
    if (snapshot.dailyGrossProfit >= 220) reasons.push(`日收益约 ${Math.round(snapshot.dailyGrossProfit)} ${currencyName}，现金垫子在变厚。`);
    else reasons.push(`日收益约 ${Math.round(snapshot.dailyGrossProfit)} ${currencyName}，增长偏稳但不爆发。`);
  }

  if (reasons.length < 2) {
    if (snapshot.priceRisk > 0) reasons.push("售价高出参考价太多，评论会更容易追问成本和品类。");
    else if (summary.risk >= 60) reasons.push("风险已经进入中高位，继续冲量会更快透支安全边际。");
    else if (summary.traffic < 38) reasons.push("流量偏低，扩张前要先维护声望或买一轮流量。");
    else reasons.push("风险和流量都还在可控区间，适合按计划经营。");
  }

  return { tone, title, badge, reasons: reasons.slice(0, 2) };
}

function renderDiagnosisPanel() {
  const snapshot = operatingSnapshot(state);
  const diagnosis = buildDiagnosis(snapshot);
  $("#diagnosisPanel").className = `diagnosis-panel ${diagnosis.tone}`;
  $("#diagnosisPanel").innerHTML = `
    <div class="diagnosis-lead">
      <strong>${diagnosis.title}</strong>
      <span>${diagnosis.badge}</span>
    </div>
    <ul class="diagnosis-list">
      ${diagnosis.reasons.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function renderModelPanel() {
  const snapshot = operatingSnapshot(state);
  $("#modelPanel").innerHTML = `
    <div class="model-grid">
      <div><span>预计销量</span><strong>${Math.round(snapshot.dailySales)} 份</strong></div>
      <div><span>日收益</span><strong>${Math.round(snapshot.dailyGrossProfit)} ${currencyName}</strong></div>
      <div><span>风险变化</span><strong>${snapshot.dailyRisk >= 0 ? "+" : ""}${Math.round(snapshot.dailyRisk)}</strong></div>
      <div><span>流量变化</span><strong>${snapshot.dailyHeat >= 0 ? "+" : ""}${Math.round(snapshot.dailyHeat)}</strong></div>
      <div><span>单份毛利</span><strong>${snapshot.unitMargin.toFixed(1)} ${currencyName}</strong></div>
      <div><span>固定压力</span><strong>${Math.round(snapshot.challengeCost || 0)} ${currencyName}</strong></div>
    </div>
    <p>${snapshot.suspended ? "停业期间没有销售收入，只扣少量待命成本。" : "存款会按日收益在当天连续变化；风险、流量、口碑和票据会随经营记录推进。"}</p>
  `;
}

function renderOptionPanel(id, options, activeKey, dataName) {
  $(`#${id}`).innerHTML = Object.entries(options)
    .map(
      ([key, option]) => `
        <button class="option-button ${key === activeKey ? "active" : ""}" type="button" data-${dataName}="${key}">
          <strong>${option.label}</strong>
          <span>${option.desc}</span>
        </button>
      `,
    )
    .join("");
}

function marketReadiness(market) {
  const option = marketDisplayOption(market);
  const traffic = trafficScore();
  return {
    staffReady: state.staff >= option.requiredStaff,
    trafficReady: traffic >= option.requiredTraffic,
    traffic,
  };
}

function marketBlockReason(market, moneyCost) {
  const option = marketDisplayOption(market);
  const readiness = marketReadiness(market);
  if (!readiness.staffReady) return `需 ${option.requiredStaff} 人`;
  if (!readiness.trafficReady) return `流量 ${option.requiredTraffic}`;
  if (state.cash < moneyCost) return `还差 ${Math.ceil(moneyCost - state.cash)} ${currencyName}`;
  return "";
}

function marketActionHint({ key, unlocked, contact, marketSuspended, contactBlockReason, unlockBlockReason }) {
  if (marketSuspended) return "整顿中，暂时不能操作。";
  if (key === "whale") return "起步市场默认营业，不能关闭。";
  if (unlocked) return "点击可暂停这个区域，降低订单规模和监管压力。";
  if (contact === "requested") return "好友申请已经发出，等对方通过后会出现对接聊天。";
  if (isUniversityMarket(key) && contact === "ready") return "对方已通过，去聊天完成对接后会自动营业。";
  if (contact === "ready") return unlockBlockReason ? `暂时不能解锁：${unlockBlockReason}。` : "条件满足，点击花钱解锁营业。";
  return contactBlockReason ? `暂时不能申请：${contactBlockReason}。` : "条件满足，点击申请对接。";
}

function marketDisplayOption(key) {
  const option = marketOptions[key];
  if (key !== "whale") return option;
  return { ...option, label: homeSchoolName(), desc: `${homeSchoolName()}起步市场，单校收益较低，适合先把基本盘跑顺。` };
}

function renderMarketPanel() {
  $("#marketPanel").innerHTML = visibleMarketKeys()
    .map((key) => {
      const market = marketDisplayOption(key);
      const unlocked = state.markets[key];
      const contact = state.marketContacts[key];
      const marketSuspended = (state.marketSuspensions[key] || 0) >= state.calendarDay;
      const readiness = marketReadiness(key);
      const canRequest = readiness.staffReady && readiness.trafficReady && state.cash >= market.contactCost;
      const canUnlock = contact === "ready" && !marketSuspended && readiness.staffReady && readiness.trafficReady && state.cash >= market.unlockCost;
      const contactBlockReason = marketBlockReason(key, market.contactCost);
      const unlockBlockReason = marketBlockReason(key, market.unlockCost);
      const actionHint = marketActionHint({ key, unlocked, contact, marketSuspended, contactBlockReason, unlockBlockReason });
      const lockedClass = unlocked ? "" : "locked";
      const buttonText = marketSuspended
        ? "整顿中"
        : unlocked
        ? key === "whale"
          ? "营业中"
          : "暂停"
        : contact === "ready"
          ? isUniversityMarket(key)
            ? "去对接"
            : unlockBlockReason || `${market.unlockCost} ${currencyName}`
          : contact === "requested"
            ? "等待"
            : contactBlockReason || (isUniversityMarket(key) ? "申请" : `${market.contactCost} ${currencyName}`);
      const disabled =
        marketSuspended ||
        key === "whale" ||
        (!unlocked && contact === "requested") ||
        (!unlocked && contact !== "ready" && !canRequest) ||
        (!unlocked && contact === "ready" && !isUniversityMarket(key) && !canUnlock);
      return `
        <section class="market-card ${lockedClass}">
          <div class="market-head">
            <strong>${market.label}</strong>
            <button
              class="market-button ${unlocked ? "active" : ""}"
              type="button"
              data-market="${key}"
              title="${actionHint}"
              aria-label="${market.label}：${actionHint}"
              ${disabled ? "disabled" : ""}
            >${buttonText}</button>
          </div>
          <p>${market.desc}</p>
          <div class="market-requirements">
            <span class="${readiness.staffReady ? "ready" : ""}">摊贩 ${state.staff}/${market.requiredStaff}</span>
            <span class="${readiness.trafficReady ? "ready" : ""}">流量 ${readiness.traffic}/${market.requiredTraffic}</span>
          </div>
          <div class="market-stats">
            <span>日需求<strong>${market.dailyDemand}</strong></span>
            <span>曝光<strong>${Math.round(market.exposure * 100)}</strong></span>
            <span>监管<strong>${Math.round(market.regulation * 100)}</strong></span>
          </div>
        </section>
      `;
    })
    .join("");
}

function renderStaffPanel() {
  $("#staffLabel").textContent = `${state.staff} 人`;
  $("#staffHint").textContent = `日工资 ${state.staff * operatingModel.staffDailyWage} ${currencyName}，产能 ${Math.round(operatingSnapshot(state).dailyCapacity)} 份/日`;
  $$("[data-staff-delta]").forEach((button) => {
    const delta = Number(button.dataset.staffDelta);
    const next = state.staff + delta;
    const reason =
      next < 1
        ? "至少保留 1 名摊贩"
        : next > 6
          ? "最多 6 名摊贩"
          : delta > 0 && state.cash < operatingModel.staffHiringCost
            ? `还差 ${Math.ceil(operatingModel.staffHiringCost - state.cash)} ${currencyName}`
            : delta > 0
              ? `雇 1 人花费 ${operatingModel.staffHiringCost} ${currencyName}`
              : "减少 1 名摊贩，产能下降但工资减少";
    button.disabled = next < 1 || next > 6 || (delta > 0 && state.cash < operatingModel.staffHiringCost);
    button.title = reason;
    button.setAttribute("aria-label", reason);
  });
}

function renderActionButtons() {
  const reputationShort = Math.ceil(operatingModel.reputationCost - state.cash);
  const trafficShort = Math.ceil(operatingModel.trafficCost - state.cash);
  const reputationDisabled = state.cash < operatingModel.reputationCost;
  const trafficDisabled = state.cash < operatingModel.trafficCost;
  $("#reputationButton").disabled = reputationDisabled;
  $("#trafficButton").disabled = trafficDisabled;
  $("#reputationButton span").textContent = reputationDisabled
    ? `还差 ${reputationShort} ${currencyName}`
    : `${operatingModel.reputationCost} ${currencyName}，口碑+票据`;
  $("#trafficButton span").textContent = trafficDisabled
    ? `还差 ${trafficShort} ${currencyName}`
    : `${operatingModel.trafficCost} ${currencyName}，流量 +${operatingModel.trafficBoost}`;
  $("#reputationButton").title = reputationDisabled ? "现金不足，暂时不能提高声望。" : "花钱做补偿和公开说明，声望会逐步回升。";
  $("#trafficButton").title = trafficDisabled ? "现金不足，暂时不能买流量。" : "买同城流量会提高需求，也会带来一点曝光风险。";
  $("#reputationButton").setAttribute("aria-label", $("#reputationButton").title);
  $("#trafficButton").setAttribute("aria-label", $("#trafficButton").title);
}

function renderOperatingPanels() {
  renderFeatureVisibility();
  renderPricingPanel();
  renderDiagnosisPanel();
  renderModelPanel();
  renderOptionPanel("policyPanel", policyOptions, state.policy, "policy");
  renderOptionPanel("sourcePanel", sourceOptions, state.source, "source");
  renderMarketPanel();
  renderStaffPanel();
  renderActionButtons();
}

function renderFeatureVisibility() {
  $$("[data-feature-day]").forEach((section) => {
    const unlockDay = Number(section.dataset.featureDay);
    section.hidden = state.calendarDay < unlockDay;
  });
  if (state.started && !state.ended) notifyFeatureUnlocks();
}

function renderProgress() {
  const visiblePending = visibleTasks().filter((item) => !isDone(item)).length;
  const locked = chapterTasks().length - visibleTasks().length;
  const { risk } = getMetricSummary();
  const tickerActive = isTickerActive();
  $("#dayStatus").textContent = tickerActive
    ? state.tickerText
    : isBusinessSuspended()
    ? `${state.suspensionReason || "停业整顿"}中`
    : risk >= 82
      ? "风险临界，优先降风险"
      : risk >= 68
        ? "风险偏高，别只顾收益"
    : visiblePending
    ? "有新消息待处理"
    : locked
      ? `等待新消息，时间快进中`
      : "今日经营自动推进中";
  $$("[data-speed]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === state.speed);
  });
  const pauseButton = $("#pauseButton");
  if (pauseButton) {
    const paused = state.speed === 0;
    pauseButton.textContent = paused ? "▶" : "⏸";
    pauseButton.title = paused ? "继续" : "暂停";
    pauseButton.setAttribute("aria-label", paused ? "继续" : "暂停");
    pauseButton.classList.toggle("active", paused);
  }
  $$("[data-main-tab='control']").forEach((button) => {
    button.classList.toggle("attention", isControlUnlockTickerActive());
  });
}

function renderPhoneLayer() {
  const list = document.querySelector("#taskBanners");
  const conversation = document.querySelector("#conversationView");
  const ending = document.querySelector("#endingView");
  ending.hidden = true;

  if (!state.activeChatTitle) {
    list.hidden = false;
    conversation.hidden = true;
    return;
  }

  list.hidden = true;
  conversation.hidden = false;
  renderConversation(task());
}

function render() {
  const current = day();
  if (state.started) revealUnlockedEvents();
  if (!isUnlocked(state.activeTask)) {
    const firstVisible = chapterTasks().findIndex((_, index) => isUnlocked(index));
    state.activeTask = Math.max(0, firstVisible);
  }
  const active = task();
  document.querySelector(".reply-panel").classList.remove("ending");
  document.querySelector("#dayLabel").textContent = `第 ${state.calendarDay} 天`;
  document.querySelector("#eventTitle").textContent = formatText(current.title);
  document.querySelector("#phaseTag").textContent = formatText(active.phase);
  document.querySelector("#eventBody").textContent = "";

  renderStats();
  renderMetrics();
  renderStallScene();
  renderBanners();
  renderPhoneLayer();
  renderLog();
  renderHistory();
  renderOperatingPanels();
  renderRoutePanel();
  renderProgress();
  setMainTab(state.activeMainTab);
  saveGame();
}

function endingAnalysisRows(ending) {
  const summary = getMetricSummary();
  const finalScore = endingScore(summary);
  const handled = Object.keys(state.completed).length;
  const honest = state.honestDays;
  const route = ending.route || dominantRoute().route;
  const [routeLabel, routeDesc] = routeDetails[route] || ["未定路线", "这局没有形成足够明确的经营倾向。"];
  const routeSummary = Object.entries(state.routes)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, score]) => `${routeDetails[key]?.[0] || key} ${score}`)
    .join("，");
  const reports = state.dayReports || [];
  const averageCashDelta = reports.length
    ? Math.round(reports.reduce((sum, report) => sum + report.cashDelta, 0) / reports.length)
    : 0;
  const bestReport = reports.length
    ? reports.reduce((best, report) => (report.cashDelta > best.cashDelta ? report : best), reports[0])
    : null;
  const rows = [
    ["结局", ending.name],
    ["综合分数", `${finalScore} 分（存款越多、风险越低、流量越高，分数越高）`],
    ["主路线", `${routeLabel}：${routeDesc}`],
    ["经营结果", `存款 ${summary.bank} ${currencyName}，风险 ${summary.risk}，流量 ${summary.traffic}`],
    ["经营复盘", reports.length ? `经营 ${reports.length} 天，平均每天 ${averageCashDelta >= 0 ? "+" : ""}${averageCashDelta} ${currencyName}。` : "这局还没有完整经营记录。"],
    ["处理记录", `我处理了 ${handled} 个关键对话，其中偏透明/送检/退款的选择约 ${honest} 次。`],
  ];

  if (routeSummary) rows.push(["路线倾向", routeSummary]);
  if (bestReport) {
    rows.push([
      "最好一天",
      `第 ${bestReport.day} 天净增 ${bestReport.cashDelta >= 0 ? "+" : ""}${bestReport.cashDelta} ${currencyName}，卖出 ${bestReport.sales} 份。`,
    ]);
  }

  if (state.flags.clearLabel) rows.push(["菜单", "我曾经尝试把商品名和原料写清楚，后续争议更容易解释。"]);
  if (state.flags.shadyStock) rows.push(["进货", "我接过含糊或低价批次，利润变厚，但票据和食品疑点也被放大。"]);
  if (state.flags.studentRefund) rows.push(["退款", "我打开过退款口，现金压力变大，但监管和舆论风险下降。"]);
  if (state.flags.prAgency) rows.push(["公关", "我用过包装叙事的方式处理舆论，热度可能短降，但信任没有真正恢复。"]);
  if (state.risk > 65) rows.push(["风险", "风险指标过高，说明我很多时候在用话术拖延事实核对。"]);
  if (state.cash < 18) rows.push(["现金", "现金太低，说明诚信路线也需要重新设计定价和规模，否则好生意也会被成本压垮。"]);
  if (state.reputation > 65 && state.documents > 65) rows.push(["信任", "口碑和票据都还站得住，说明小摊可以少一点传奇，多一点明账。"]);

  return rows;
}

function endingScore(summary = getMetricSummary()) {
  const cashScore = clamp(summary.bank / 3000, 0, 1) * 520;
  const riskScore = clamp((100 - summary.risk) / 100, 0, 1) * 300;
  const trafficScorePart = clamp(summary.traffic / 100, 0, 1) * 180;
  return Math.round(cashScore + riskScore + trafficScorePart);
}

function endingScorecardItems() {
  const summary = getMetricSummary();
  const reports = state.dayReports || [];
  const averageCashDelta = reports.length
    ? Math.round(reports.reduce((sum, report) => sum + report.cashDelta, 0) / reports.length)
    : 0;
  const bestReport = reports.length
    ? reports.reduce((best, report) => (report.cashDelta > best.cashDelta ? report : best), reports[0])
    : null;
  return [
    {
      label: "综合分数",
      value: `${endingScore(summary)} 分`,
      tone: endingScore(summary) >= 720 ? "good" : endingScore(summary) < 420 ? "bad" : "",
    },
    {
      label: "最终存款",
      value: `${summary.bank} ${currencyName}`,
      tone: summary.bank >= 900 ? "good" : summary.bank < 120 ? "bad" : "",
    },
    {
      label: "最终风险",
      value: `${summary.risk}%`,
      tone: summary.risk >= 78 ? "bad" : summary.risk >= 60 ? "warn" : "good",
    },
    {
      label: "平均日收益",
      value: `${averageCashDelta >= 0 ? "+" : ""}${averageCashDelta} ${currencyName}`,
      tone: averageCashDelta >= 200 ? "good" : averageCashDelta < 0 ? "bad" : "",
    },
    {
      label: "最佳日",
      value: bestReport ? `第 ${bestReport.day} 天 ${bestReport.cashDelta >= 0 ? "+" : ""}${bestReport.cashDelta} ${currencyName}` : "无",
      tone: bestReport && bestReport.cashDelta > 0 ? "good" : "",
    },
  ];
}

function renderEndingScorecard() {
  $("#endingScorecard").innerHTML = endingScorecardItems()
    .map(
      (item) => `
        <div class="score-tile ${item.tone}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </div>
      `,
    )
    .join("");
}

function renderEnding(ending) {
  state.ended = true;
  state.activeChatTitle = "";
  $("#dayLabel").textContent = `第 ${state.calendarDay} 天`;
  $("#dayStatus").textContent = "经营结束";
  $("#taskBanners").hidden = true;
  $("#conversationView").hidden = true;
  $("#endingView").hidden = false;
  $("#endingTitle").textContent = ending.name;
  $("#endingBody").textContent = ending.body;
  renderEndingScorecard();
  $("#endingAnalysis").innerHTML = endingAnalysisRows(ending)
    .map(([label, text]) => `<div><strong>${label}</strong><span>${text}</span></div>`)
    .join("");
  renderStats();
  renderMetrics();
  renderStallScene();
  renderLog();
  renderHistory();
  renderOperatingPanels();
  renderRoutePanel();
  saveGame();
}

function resetGame() {
  clearSavedGame();
  savedGame = null;
  state = structuredClone(initialState);
  tutorialIndex = 0;
  const input = $("#schoolNameInput");
  if (input) {
    input.value = "";
    delete input.dataset.ready;
  }
  $("#introOverlay").classList.remove("hidden");
  $("#introOverlay").hidden = false;
  renderTutorial();
  render();
}

function togglePause() {
  state.autoPausedForPending = false;
  state.speed = state.speed === 0 ? 1 : 0;
  renderProgress();
  renderStallScene();
}

function renderTutorial() {
  const step = tutorialSteps[tutorialIndex];
  const hasSave = Boolean(savedGame);
  const showSchoolSetup = step.setup === "school" && !hasSave;
  const input = $("#schoolNameInput");
  if (input && showSchoolSetup && !input.dataset.ready) {
    input.value = "";
    input.dataset.ready = "true";
  }
  $("#tutorialStepLabel").textContent = `新手教程 ${tutorialIndex + 1} / ${tutorialSteps.length}`;
  $("#tutorialTitle").textContent = step.title;
  $("#tutorialBody").textContent = step.body;
  $("#tutorialList").innerHTML = step.items.map((item) => `<li>${item}</li>`).join("");
  $$(".tutorial-progress span").forEach((dot, index) => {
    dot.classList.toggle("active", index <= tutorialIndex);
  });
  const isLast = tutorialIndex === tutorialSteps.length - 1;
  $(".tutorial-actions").hidden = hasSave;
  $("#nextTutorialButton").hidden = hasSave || isLast;
  $("#startButton").hidden = hasSave || !isLast;
  $("#savePanel").hidden = !hasSave;
  $(".school-setup").hidden = !showSchoolSetup;
  setSchoolNameError();
  if (savedGame) $("#saveSummary").textContent = savedGameSummary();
}

function nextTutorialStep() {
  tutorialIndex = Math.min(tutorialSteps.length - 1, tutorialIndex + 1);
  renderTutorial();
}

function skipTutorial() {
  tutorialIndex = tutorialSteps.length - 1;
  renderTutorial();
  $("#schoolNameInput")?.focus();
}

function startGame() {
  const input = $("#schoolNameInput");
  const validation = syncSchoolNameInput(input);
  if (!validation.ok) {
    setSchoolNameError(validation.message, true);
    input?.focus();
    return false;
  }
  state.homeSchoolName = normalizeSchoolName(validation.base);
  state.selectedUniversityMarkets = pickUniversityMarkets(state.homeSchoolName);
  resetConversationState();
  state.started = true;
  pushHistory("我开始营业");
  $("#introOverlay").classList.add("hidden");
  $("#introOverlay").hidden = true;
  render();
  return true;
}

function continueSavedGame() {
  if (!savedGame?.state) return;
  state = mergeSavedState(initialState, savedGame.state);
  state.speed = state.ended ? 0 : 1;
  $("#introOverlay").classList.add("hidden");
  $("#introOverlay").hidden = true;
  render();
}

function startFreshRun() {
  clearSavedGame();
  savedGame = null;
  $("#savePanel").hidden = true;
  startGame();
}

function setPrice(value) {
  const nextPrice = clamp(Number(value), 12, 100);
  if (nextPrice === state.price) return;
  state.price = nextPrice;
  renderMetrics();
  renderOperatingPanels();
  saveGame();
}

function setMainTab(tab) {
  if (!["chat", "control"].includes(tab)) return;
  state.activeMainTab = tab;
  $$("[data-main-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mainTab === tab);
    if (button.dataset.mainTab === "control") button.classList.toggle("attention", isControlUnlockTickerActive());
  });
  $$("[data-main-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.mainPanel !== tab;
  });
}

function setPolicy(policy) {
  if (!policyOptions[policy] || state.policy === policy) return;
  state.policy = policy;
  if (policy === "transparent") scoreRoute("compliance", 1);
  if (policy === "hype") scoreRoute("hype", 1);
  if (policy === "balanced") scoreRoute("contraction", 0.5);
  const effects =
    policy === "transparent"
      ? { cash: -6, reputation: 4, documents: 6, risk: -5, heat: -2 }
      : policy === "hype"
        ? { cash: 8, heat: 10, risk: 5, reputation: -2 }
        : { cash: 2, heat: 2, risk: -1 };
  applyImmediateEffects(effects);
  state.log.unshift(`经营政策改为：${policyOptions[policy].label}。`);
  state.log = state.log.slice(0, 12);
  render();
}

function setSource(source) {
  if (!sourceOptions[source] || state.source === source) return;
  state.source = source;
  state.productFocus = source === "goose" ? "goose" : source === "freshDuck" ? "duck" : "cheapDuck";
  if (source === "goose") scoreRoute("compliance", 1);
  if (source === "freshDuck") scoreRoute("goodwill", 0.5);
  if (source === "frozenDuck") scoreRoute("evasion", 1);
  const effects =
    source === "goose"
      ? { cash: -10, reputation: 5, documents: 5, risk: -4, heat: -2 }
      : source === "freshDuck"
        ? { cash: 2, reputation: 2, documents: 2, risk: -2 }
        : { cash: 12, heat: 7, risk: 8, reputation: -3, documents: -6 };
  applyImmediateEffects(effects);
  state.log.unshift(`货源改为：${sourceOptions[source].label}。`);
  state.log = state.log.slice(0, 12);
  render();
}

function toggleMarket(market) {
  if (!marketOptions[market] || market === "whale") return;
  if (state.markets[market]) {
    state.markets[market] = false;
    scoreRoute("contraction", 1);
    state.log.unshift(`${marketDisplayOption(market).label} 暂停营业，订单规模收缩。`);
    render();
    return;
  }

  if (isUniversityMarket(market) && state.marketContacts[market] === "ready") {
    state.manualCampusRequests ||= {};
    state.manualCampusRequests[market] = "pending";
    state.activeMainTab = "chat";
    const text = `${marketDisplayOption(market).label} 对接聊天已置顶，处理后自动营业。`;
    pushHistory(text);
    showTicker(text);
    render();
    return;
  }

  if (state.marketContacts[market] !== "ready") {
    requestMarketContact(market);
    return;
  }

  const cost = marketOptions[market].unlockCost;
  const readiness = marketReadiness(market);
  if (!readiness.staffReady || !readiness.trafficReady) return;
  if (state.cash < cost) return;
  state.cash = Math.max(0, state.cash - cost);
  applyEffects({ heat: 4, risk: 2 }, { duration: 90 });
  state.markets[market] = true;
  scoreRoute(market === "cbd" ? "hype" : "contraction", 1);
  state.log.unshift(`${marketDisplayOption(market).label} 解锁，新的取餐和舆论压力开始进入经营。`);
  state.log = state.log.slice(0, 12);
  render();
}

function openUniversityMarket(market, source = "incoming") {
  if (!isUniversityMarket(market) || !marketOptions[market]) return;
  const wasOpen = state.markets[market];
  state.marketContacts[market] = "ready";
  state.markets[market] = true;
  applyEffects({ heat: source === "manual" ? 5 : 7, risk: 2 }, { duration: 90 });
  scoreRoute("hype", source === "manual" ? 0.5 : 1);
  if (!wasOpen) {
    const text = `${marketDisplayOption(market).label} 开始营业，跨校订单进入需求曲线。`;
    state.log.unshift(text);
    state.log = state.log.slice(0, 12);
    pushHistory(text);
    showTicker(text);
  }
}

function requestMarketContact(market) {
  const option = marketDisplayOption(market);
  const readiness = marketReadiness(market);
  if (!option || state.marketContacts[market] !== "locked" || !readiness.staffReady || !readiness.trafficReady || state.cash < option.contactCost) return;
  state.cash = Math.max(0, state.cash - option.contactCost);
  applyEffects({ heat: 1 }, { duration: 45 });
  state.marketContacts[market] = "requested";
  state.marketRequestDue[market] = gameElapsedMinutes() + (isUniversityMarket(market) ? 45 : 120);
  const text = isUniversityMarket(market)
    ? `我向${option.label}发出入驻申请，等对方来对接。`
    : `我向${option.label}发出好友申请，等对方通过后才能开团。`;
  state.log.unshift(text);
  state.log = state.log.slice(0, 12);
  pushHistory(text);
  showTicker(text);
  render();
}

function improveReputation() {
  if (state.cash < operatingModel.reputationCost) return;
  state.cash = Math.max(0, state.cash - operatingModel.reputationCost);
  applyEffects({ reputation: 7, documents: 2, heat: -1 }, { duration: 120 });
  scoreRoute("goodwill", 1);
  state.log.unshift("我做了公开补偿和口碑维护，声望会逐步回升。");
  state.log = state.log.slice(0, 12);
  render();
}

function buyTraffic() {
  if (state.cash < operatingModel.trafficCost) return;
  state.cash = Math.max(0, state.cash - operatingModel.trafficCost);
  applyEffects({ heat: 5, risk: 1 }, { duration: 90 });
  state.paidTraffic = clamp(state.paidTraffic + operatingModel.trafficBoost, 0, 100);
  scoreRoute("hype", 1);
  state.log.unshift("我买了一轮同城流量，短期需求和曝光会上升。");
  state.log = state.log.slice(0, 12);
  render();
}

function changeStaff(delta) {
  const next = state.staff + delta;
  if (next < 1 || next > 6) return;
  if (delta > 0) {
    if (state.cash < operatingModel.staffHiringCost) return;
    state.cash = Math.max(0, state.cash - operatingModel.staffHiringCost);
    applyEffects({ dailyExpense: 2, risk: 1 }, { duration: 60 });
    state.log.unshift("我临时雇了一名摊贩，产能上升，工资和管理压力也上升。");
  } else {
    scoreRoute("contraction", 1);
    state.log.unshift("我减少了一名摊贩，产能下降，固定开支也少了。");
  }
  state.staff = next;
  state.log = state.log.slice(0, 12);
  render();
}

$("#resetButton").addEventListener("click", resetGame);
$("#backToChatsButton").addEventListener("click", () => {
  state.activeChatTitle = "";
  render();
});
$("#againButton").addEventListener("click", resetGame);
$("#settingsButton").addEventListener("click", () => {
  $("#settingsPanel").hidden = false;
});
$("#pauseButton").addEventListener("click", togglePause);
$("#closeSettingsButton").addEventListener("click", () => {
  $("#settingsPanel").hidden = true;
});
$$("[data-main-tab]").forEach((button) => {
  button.addEventListener("click", () => setMainTab(button.dataset.mainTab));
});
$("#priceInput").addEventListener("input", (event) => {
  setPrice(event.target.value);
});
$("#schoolNameInput").addEventListener("input", (event) => {
  if (event.isComposing || event.target.dataset.composing === "true") return;
  syncSchoolNameInput(event.target);
});
$("#schoolNameInput").addEventListener("compositionstart", (event) => {
  event.target.dataset.composing = "true";
});
$("#schoolNameInput").addEventListener("compositionend", (event) => {
  delete event.target.dataset.composing;
  syncSchoolNameInput(event.target);
});
$("#policyPanel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-policy]");
  if (button) setPolicy(button.dataset.policy);
});
$("#sourcePanel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-source]");
  if (button) setSource(button.dataset.source);
});
$("#marketPanel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-market]");
  if (button) toggleMarket(button.dataset.market);
});
$("#reputationButton").addEventListener("click", improveReputation);
$("#trafficButton").addEventListener("click", buyTraffic);
$$("[data-staff-delta]").forEach((button) => {
  button.addEventListener("click", () => changeStaff(Number(button.dataset.staffDelta)));
});
$$("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    renderProgress();
  });
});
$("#nextTutorialButton").addEventListener("click", nextTutorialStep);
$("#skipTutorialButton").addEventListener("click", skipTutorial);
$("#startButton").addEventListener("click", startFreshRun);
$("#continueButton").addEventListener("click", continueSavedGame);
$("#newRunButton").addEventListener("click", resetGame);
renderTutorial();
render();
timerId = setInterval(tick, tickMs);
