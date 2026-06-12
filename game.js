const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const initialState = {
  dayIndex: 0,
  calendarDay: 1,
  activeTask: 0,
  minute: 9 * 60,
  started: false,
  speed: 1,
  tickCarry: 0,
  cash: 42,
  reputation: 58,
  conscience: 66,
  risk: 18,
  heat: 36,
  family: 22,
  documents: 34,
  margin: 46,
  cost: 28,
  dailyExpense: 22,
  honestDays: 0,
  flags: {
    clearLabel: false,
    shadyStock: false,
    invoice: false,
    apology: false,
    prAgency: false,
    studentRefund: false,
  },
  completed: {},
  replies: {},
  requests: {},
  chatHistory: {},
  knownChats: {},
  chatOrder: [],
  activeChatTitle: "",
  injectedMessages: {},
  overdueHits: {},
  dayCostsCharged: {},
  history: [],
  seenTasks: {},
  log: [],
  ended: false,
};

let state = structuredClone(initialState);
let timerId = null;

const dayStart = 9 * 60;
const dayEnd = 21 * 60;
const campaignDays = 7;
const tickMinutes = 1;
const tickMs = 100;

const metricDetails = {
  profitDetails: [
    ["毛利空间", "margin"],
    ["成本", "cost"],
    ["日常花销", "dailyExpense"],
  ],
  riskDetails: [
    ["票据缺口", "documents", true],
    ["监管压力", "risk"],
    ["良心亏空", "conscience", true],
  ],
  trafficDetails: [
    ["群聊热度", "heat"],
    ["口碑", "reputation"],
    ["未读压力", "family"],
  ],
};

const whaleGooseGroup = "白鲸大学西南门鹅腿群34";
const whaleDuckGroup = "白鲸大学西南门鸭腿群34";
const frogGooseGroup = "青蛙大学东门鹅腿群35";
const frogDuckGroup = "青蛙大学东门鸭腿群35";
const auntGroupNick = "鸭腿阿姨-好友满了请加114514";

function groupsRenamedAfterIncident() {
  return Boolean(state.flags.clearLabel || state.flags.apology || state.flags.studentRefund);
}

function currentWhaleGroupTitle() {
  return groupsRenamedAfterIncident() ? whaleDuckGroup : whaleGooseGroup;
}

const dailyNoticeTask = {
  id: "daily-notice",
  banner: "今日经营",
  icon: "营",
  phase: "开卖",
  title: "发今日经营通知",
  body: "",
  phone: {
    title: whaleGooseGroup,
    unread: 1,
    messages: [
      [auntGroupNick, "🙋配送信息都在下单小程序主页里啦~"],
      [auntGroupNick, "🍖专属优惠券已发放，领券下单更划算!"],
      [auntGroupNick, "晚7:30左右送到，等到11:20左右。毕业季啦，同学们吃一次少一次呢，想吃请下单啦🌹 @所有人"],
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

function chapterTasks() {
  return [dailyNoticeForCurrentState(), ...day().tasks];
}

function getMetricSummary() {
  return {
    profit: clamp(Math.round(state.cash)),
    risk: clamp(Math.round((state.risk * 0.55) + ((100 - state.documents) * 0.3) + ((100 - state.conscience) * 0.15))),
    traffic: clamp(Math.round((state.heat * 0.65) + (state.reputation * 0.35))),
  };
}

const chapters = [
  {
    day: 1,
    title: "小程序爆单",
    summary: "白鲸大学群里开始疯传小程序下单，供应商和学生同时催我回复。",
    tasks: [
      {
        id: "startup-idea",
        banner: "供应商老王",
        icon: "想",
        phase: "初创",
        title: "只卖一种腿",
        body:
          "我还没爆单，只是在想能不能把摊位做简单：不卖一堆烧烤，就只卖一款热腿，靠群接龙控制数量。",
        phone: {
          title: "供应商老王",
          unread: 5,
          messages: [
            ["供应商老王", "叔，你别啥都卖，累。"],
            ["供应商老王", "就做一种腿，学生好记，群里也好接龙。"],
            ["供应商老王", "但名字要想好，名字一火，以后就不好改。"],
          ],
        },
        choices: [
          {
            title: "我先叫校园烤腿",
            desc: "不蹭品类，起步慢。",
            cost: "慢热",
            reply: "先叫校园烤腿，卖什么就写什么。",
            effects: { cash: -2, reputation: 4, conscience: 5, documents: 6, risk: -4, heat: -2 },
            log: "你用校园烤腿起步，名字没那么抓人，但后面好解释。",
          },
          {
            title: "我直接叫鹅腿",
            desc: "好传播，但会被名字绑住。",
            cost: "容易火",
            reply: "就叫鹅腿，学生一听就知道是什么。",
            effects: { cash: 6, reputation: 2, conscience: -3, documents: -4, risk: 5, heat: 10 },
            log: "你把招牌叫成鹅腿，名字很快被学生记住。",
          },
          {
            title: "我先不写清，靠口口相传",
            desc: "最灵活，也最含糊。",
            cost: "埋隐患",
            reply: "先别写太死，群里怎么叫就怎么传。",
            effects: { cash: 8, reputation: -2, conscience: -6, documents: -8, risk: 8, heat: 8 },
            log: "你让名字跟着群聊走，起步很灵活，账本也开始变模糊。",
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
          "我刚收到供货商消息。订单又爆了，但正经大鹅腿要等；鸭边腿当天能送，冷库老货还能再便宜。",
        phone: {
          title: "供应商老王",
          unread: 12,
          messages: [
            ["供应商老王", "叔，鹅腿今天真没那么多。"],
            ["供应商老王", "鸭边腿当天到，口感差不多，利润厚。"],
            ["供应商老王", "冷库老货再便宜三成，别问太细。"],
          ],
        },
        choices: [
          {
            title: "我只要能对上票的真鹅腿",
            desc: "少卖一点，先把原料说清楚。",
            cost: "稳妥但少赚",
            reply: "真鹅腿有多少来多少，票据和批次一起给我。",
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
          "老王发来新的报价：真鹅腿要等，鲜鸭腿今晚能到，冻鸭边腿最便宜但批次复杂。群里订单已经压上来。",
        phone: {
          title: "供应商老王",
          unread: 23,
          messages: [
            ["供应商老王", "叔，今天三个方案。"],
            ["供应商老王", "真鹅腿少，鲜鸭腿稳，冻鸭边腿便宜但票别问太细。"],
            ["供应商老王", "你要扩校区，供货名字就得早点想好。"],
          ],
        },
        choices: [
          {
            title: "我只收真鹅腿和完整票据",
            desc: "数量少，账最清。",
            cost: "少卖",
            reply: "真鹅腿和票据一起送，数量不够我就在小程序写限量。",
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
        banner: "白鲸鹅腿群",
        icon: "群",
        phase: "学生群",
        title: "小程序订单到了西南门",
        body:
          "我打开白鲸大学西南门鹅腿群34，里面已经 328 条未读。群里都在问小程序下单后到哪个门取、辣和不辣还有几份。",
        phone: {
          title: "白鲸大学西南门鹅腿群34",
          unread: 328,
          messages: [
            ["鸭腿阿姨-好友满了请加114514", "🏃到了到了到了 请到西南门外左手边取"],
            ["鸭腿阿姨-好友满了请加114514", "🙋配送信息都在下单小程序主页里啦~"],
            ["鸭腿阿姨-好友满了请加114514", "🍖专属优惠券已发放，领券下单更划算!"],
            ["鸭腿阿姨-好友满了请加114514", "晚7:30左右送到，等到11:20左右。毕业季啦，同学们吃一次少一次呢，想吃请下单啦🌹 @所有人"],
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
        banner: "白鲸鹅腿群",
        icon: "价",
        phase: "定价",
        title: "真鹅腿涨价后没人下单",
        body:
          "我把真鹅腿按成本重新定价，群里突然安静。有人说这个价不如去店里吃，也有人问：以前十几块到底是什么腿？",
        phone: {
          title: "白鲸大学西南门鹅腿群34",
          unread: 96,
          messages: [
            ["学生C", "今天小程序怎么贵这么多？"],
            ["学生D", "如果现在这个才是真鹅腿，那以前是什么？"],
            ["群主", "叔，要不要把辣/不辣都改成限量预售？"],
          ],
        },
        choices: [
          {
            title: "我坚持真鹅腿实价",
            desc: "订单会少，但账能说清。",
            cost: "卖得很慢",
            reply: "今天是真鹅腿实价，小程序限量，辣/不辣各写清楚，嫌贵可以不下单。",
            effects: { cash: -8, reputation: 4, conscience: 8, documents: 8, risk: -5, heat: -8, margin: -6, cost: 8 },
            log: "你坚持真鹅腿实价，小程序订单变慢，账本变清楚。",
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
        banner: "白鲸鹅腿群",
        icon: "截",
        phase: "取餐",
        title: "有人拿旧截图来取餐",
        body:
          "西南门口开始排队。有同学拿昨天的小程序截图来领今天的腿，代取同学也说分不清哪些截图已经核销过。",
        phone: {
          title: "白鲸大学西南门鹅腿群34",
          unread: 137,
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
        banner: "白鲸鹅腿群",
        icon: "骨",
        phase: "考据",
        title: "群里开始对比骨头",
        body:
          "群里有考据同学贴出鹅腿和鸭腿骨头对比图，还把小程序订单、取餐截图和实物照片拼在一起。",
        phone: {
          title: "白鲸大学西南门鹅腿群34",
          unread: 214,
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
            reply: "不同批次会写清楚，鹅腿就是鹅腿，鸭腿就是鸭腿，小程序会同步改。",
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
          reject: "我拒绝了青蛙大学代取，群主在微博说我只照顾白鲸大学。",
          rejectEffects: { heat: 5, reputation: -4 },
        },
        body:
          "青蛙大学代取群主想把订单拉过去。多一个校区意味着小程序要多一个取餐点，截图核销、保温和投诉都会翻倍。",
        phone: {
          title: "青蛙大学东门鹅腿群35",
          unread: 42,
          messages: [
            ["青蛙群主", "叔，我们东门也能开团吗？"],
            ["青蛙群主", "同学小程序下单，到东门给我看截图取。"],
            ["青蛙群主", "不过送晚了他们会直接在微博挂人。"],
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
    title: "截图外溢",
    summary: "群聊截图开始外传，监管、媒体和公关都在等你的第一句话。",
    tasks: [
      {
        id: "multi-campus-truth",
        banner: "多校鹅腿群",
        icon: "续",
        phase: "继续售卖",
        title: "跨校之后还按老叫法卖吗",
        body:
          "白鲸和青蛙两个校区都在小程序下单。新增的人没吃过以前的摊，只看商品名、取餐点和订单截图判断自己买的是什么。",
        phone: {
          title: "青蛙大学东门鹅腿群35",
          unread: 188,
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
            reply: "两个学校小程序都统一写清楚：鹅腿就是鹅腿，鸭腿就是鸭腿，取餐截图照这个核销。",
            effects: { cash: -6, reputation: 8, conscience: 10, documents: 12, risk: -12, heat: -8, margin: -4 },
            log: "你把两个学校的小程序商品页统一改成明示菜单，短期订单少了。",
          },
          {
            title: "我维持老群名，只改小程序备注",
            desc: "保住热度，但解释空间很灰。",
            cost: "灰色过渡",
            reply: "群名先不改，小程序备注里会写原料，大家下单前看一下。",
            effects: { cash: 6, reputation: -2, conscience: -4, documents: 2, risk: 6, heat: 8, margin: 4 },
            log: "你把真实原料放进备注，群名继续负责传播。",
          },
          {
            title: "我让群主别讨论品类",
            desc: "最快压住争论，也最容易被截图。",
            cost: "高风险",
            reply: "先别在群里讨论品类，想买就去小程序下单。",
            effects: { cash: 14, reputation: -10, conscience: -12, documents: -12, risk: 16, heat: 12, margin: 8 },
            log: "你让群主压住品类讨论，截图很快传到微博。",
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
          unread: 64,
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
          unread: 854,
          messages: [
            ["学生E", "不管好不好吃，写鹅就得是鹅。"],
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
        banner: "微博",
        icon: "媒",
        phase: "舆论",
        title: "热搜标题只剩四个字",
        body:
          "我看到本地号、探店号、法律博主都来了。评论区开始引用消费者知情权和虚假宣传，公关公司给我三套方案。",
        phone: {
          title: "微博",
          unread: 119,
          messages: [
            ["热搜", "#鸭腿阿姨小程序商品名改了#"],
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
            title: "我买公关稿洗热搜",
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
        banner: "微博私信",
        icon: "问",
        phase: "采访",
        title: "本地号追问一句话",
        body:
          "微博本地号发来私信，问题很短：你现在卖的是鹅腿还是鸭腿？他们说如果不回，就按群截图和小程序页面写稿。",
        phone: {
          title: "微博",
          unread: 211,
          messages: [
            ["本地号私信", "方便确认一下吗，现在卖的是鹅腿还是鸭腿？"],
            ["评论", "别再讲情怀，先回答品类。"],
            ["转发", "如果是品牌名，也应该写清楚原料吧。"],
          ],
        },
        choices: [
          {
            title: "我给出明确口径",
            desc: "承认现状，少些猜测。",
            cost: "流量降温",
            reply: "现在按实际原料标注，鹅腿和鸭腿分开写，小程序页面同步更新。",
            effects: { cash: -6, reputation: 9, conscience: 10, documents: 12, risk: -12, heat: -8 },
            flag: ["clearLabel", true],
            log: "你给媒体明确口径，标题没那么刺激，但争议少了。",
          },
          {
            title: "我只发创业不易长文",
            desc: "转移焦点，容易被反问。",
            cost: "话题发散",
            reply: "我会讲这些年怎么做小摊，品类细节后面再统一说明。",
            effects: { cash: 2, reputation: -6, conscience: -8, documents: -8, risk: 10, heat: 14 },
            log: "长文发出后，评论区把每一句都折回原料问题。",
          },
          {
            title: "我不回应媒体",
            desc: "省事，但由别人替你讲。",
            cost: "被动",
            reply: "暂时不接受采访。",
            effects: { cash: 0, reputation: -5, documents: -5, risk: 8, heat: 10 },
            log: "媒体稿用了群截图和小程序页面，你失去了第一句话。",
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
          unread: 72,
          messages: [
            ["活动同学", "今晚 8:10-8:30 之间送到吗？外面冷，到了群里通知一下🌹"],
            ["鸭腿阿姨-好友满了请加114514", "参加小橙书 AMA 的同学，到西南门外领取，工作人员看发布的笔记和团号就可以取。"],
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
          unread: 163,
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
          "儿子发来消息，说他的朋友圈旅游照被人搬到微博下面，评论开始把摊位利润、家庭消费和食品标识问题混在一起算。",
        phone: {
          title: "儿子",
          unread: 18,
          messages: [
            ["儿子", "爸，我朋友圈被人截图了。"],
            ["儿子", "他们说你卖腿的钱都给我旅游了，这也太离谱。"],
            ["儿子", "我要不要发个微博解释一下？"],
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
          note: "我看到绿色截图了，可以免费帮你做一次公开送检，但结果会同步发微博。",
          accept: "我通过了检测博主好友申请。",
          reject: "我拒绝了检测博主，搬运号开始说我不敢检测。",
          rejectEffects: { risk: 10, heat: 12, reputation: -7 },
        },
        body:
          "我看到有人发出疑似绿色物质截图，还配了小程序订单截图。我不知道它到底是腌料、葱汁、拍摄色差还是变质，但它已经和“冷库老货”四个字绑在一起传播。",
        phone: {
          title: "小橙书搬运群",
          unread: 421,
          messages: [
            ["王海", "阿姨，请问腿中间绿色的是什么，好像味道不太对。"],
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
        title: "商业区档口递来合同",
        request: {
          from: "星桥商业区招商经理",
          note: "我们夜市档口缺一个爆款小吃。押一付三，统一收银，能不能把鸭腿阿姨开进来？",
          accept: "我通过了商业区招商经理好友申请。",
          reject: "我拒绝了商业区档口，招商经理把档期转给了另一个烤腿摊。",
          rejectEffects: { cash: -3, heat: -3, reputation: 2 },
        },
        body:
          "商业区想要我的流量，但合同要求统一菜单、统一收银、稳定供货。进商圈能把摊位变店，也会把小摊问题变成连锁问题。",
        phone: {
          title: "星桥商业区招商经理",
          unread: 31,
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
            reply: "你们可以挂鸭腿阿姨名号，供货自己解决。",
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
    title: "最后一晚",
    summary: "所有聊天都变成证据。你要决定这门生意是回到菜单，还是继续做人设。",
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
          unread: 38,
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
            reply: "先混着送，别让国贸和学校断货，票据后面补。",
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
        banner: "国贸群",
        icon: "爆",
        phase: "爆点",
        title: "国贸 CBD 群被举报",
        body:
          "国贸 CBD 群里有人举报，说你在商业区卖的仍按鹅腿故事传播，实际公告又写成鸭腿。群公告被截图，开始往微博扩散。",
        phone: {
          title: "国贸CBD-6群鸭腿阿姨(206)",
          unread: 206,
          messages: [
            ["群公告", "大家好，国贸本周不过来了，下周待定。被群里某位上班精英举报，正在配合相关部门工作。"],
            [auntGroupNick, "原材料是鸭腿，以后都会给大家写清楚，介意请勿下单。鸭腿阿姨叫了十几年，不存在故意欺骗宣传，耽误大家时间，万分抱歉🙏"],
            ["上班族A", "所以国贸这边之前买的到底是什么？"],
            ["转发截图", "公告已经发微博了。"],
          ],
        },
        choices: [
          {
            title: "我暂停国贸并发清楚公告",
            desc: "承认标识问题，把商业区先停掉。",
            cost: "止损",
            reply: "国贸先暂停，所有商品名、原料和退款方式我重新写清楚，再决定是否恢复。",
            effects: { cash: -18, reputation: 8, conscience: 12, documents: 16, risk: -18, heat: -8, margin: -8 },
            flag: ["apology", true],
            log: "你把国贸线先停掉，公告不再讲故事，开始讲原料和退款。",
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
            desc: "能拖热搜，信任更空。",
            cost: "公关化",
            reply: "公告重点写小本生意和感谢支持，原料问题放到后半段。",
            effects: { cash: -10, reputation: -6, conscience: -12, documents: -8, risk: 10, heat: 16 },
            flag: ["prAgency", true],
            log: "公关稿把国贸举报写成误会，网友把公告原文贴在评论区。",
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
          unread: 46,
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
        banner: "微博",
        icon: "告",
        phase: "终局",
        title: "摊灯亮到最后一晚",
        body:
          "我面前摆着群聊、票据、朋友圈、热搜、论坛旧稿和监管记录。我可以把这门生意变回生意，也可以继续把它当成人设。",
        phone: {
          title: "全网热议",
          unread: 2048,
          messages: [
            ["学生G", "我要的不是完美阿姨，是别骗我。"],
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
            reply: "旧号暂停，新号从烟火气重新开始。",
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
  return [1, 3, 6][index] || 1;
}

function chapterSpanDays(index = state.dayIndex) {
  return [2, 3, 2][index] || 1;
}

function chapterElapsedMinutes() {
  const chapterDay = Math.max(0, state.calendarDay - chapterStartDay(state.dayIndex));
  return chapterDay * (dayEnd - dayStart) + Math.max(0, state.minute - dayStart);
}

function taskDueOffset(index) {
  if (index === 0) return 45;
  const taskCount = Math.max(1, day().tasks.length);
  const chapterWindow = chapterSpanDays() * (dayEnd - dayStart);
  const usableWindow = Math.max(180, chapterWindow - 150);
  const spacing = taskCount <= 1 ? usableWindow : Math.floor(usableWindow / (taskCount - 1));
  return 75 + (index - 1) * spacing;
}

function taskDueLabel(index) {
  const offset = taskDueOffset(index);
  const dayOffset = Math.floor(offset / (dayEnd - dayStart));
  const minuteInDay = dayStart + (offset % (dayEnd - dayStart));
  const absoluteDay = Math.min(campaignDays, chapterStartDay(state.dayIndex) + dayOffset);
  return absoluteDay === state.calendarDay
    ? `${formatTime(minuteInDay)} 截止`
    : `第 ${absoluteDay} 天 ${formatTime(minuteInDay)} 截止`;
}

function syncDayIndex() {
  if (state.calendarDay >= 6) {
    state.dayIndex = 2;
  } else if (state.calendarDay >= 3) {
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
  return item.request && requestStatus(item) === "pending" ? item.request.from : item.phone.title;
}

function latestMessageText(title) {
  const messages = state.chatHistory[title] || [];
  return messages.length ? messages[messages.length - 1].text : "";
}

function rememberChat(title, details = {}) {
  if (!title) return;
  if (!state.knownChats[title]) {
    state.knownChats[title] = {
      title,
      unread: 0,
      last: "",
      kind: details.kind || "chat",
    };
    state.chatOrder.unshift(title);
  }

  state.knownChats[title] = {
    ...state.knownChats[title],
    ...details,
    title,
    last: details.last || latestMessageText(title) || state.knownChats[title].last || "",
  };
}

function forgetChat(title) {
  delete state.knownChats[title];
  state.chatOrder = state.chatOrder.filter((item) => item !== title);
}

function rememberTaskChat(item) {
  const title = chatTitleForTask(item);
  const pending = item.request && requestStatus(item) === "pending";
  rememberChat(title, {
    unread: pending ? "申请" : item.phone.unread,
    last: pending ? item.request.note : latestMessageText(item.phone.title) || item.phone.messages.at(-1)?.[1] || "",
    kind: pending ? "request" : "chat",
  });
}

function findTaskIndexForChat(title) {
  const tasks = chapterTasks();
  const pendingIndex = tasks.findIndex(
    (item, index) => isUnlocked(index) && chatTitleForTask(item) === title && !isDone(item),
  );
  if (pendingIndex >= 0) return pendingIndex;

  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    if (isUnlocked(index) && chatTitleForTask(tasks[index]) === title) return index;
  }

  return -1;
}

function appendChatMessages(title, messages) {
  state.chatHistory[title] ||= [];
  state.chatHistory[title].push(...messages.map(([who, text]) => ({ who: normalizeSpeaker(who), text })));
  rememberChat(title, { last: latestMessageText(title) });
}

function normalizeSpeaker(who) {
  return who === "鸭腿阿姨" ? "我" : who;
}

function isOwnSpeaker(who) {
  return who === "我" || who === auntGroupNick;
}

function replySpeakerForChat(title) {
  return title.includes("群") ? auntGroupNick : "我";
}

function ensureTaskMessages(item) {
  if (requestStatus(item) === "pending") return;
  const key = taskKey(item.id);
  if (!state.injectedMessages[key]) {
    state.injectedMessages[key] = true;
    appendChatMessages(item.phone.title, item.phone.messages);
  }
  rememberTaskChat(item);
}

function dueMinute(index) {
  const offset = taskDueOffset(index);
  return dayStart + (offset % (dayEnd - dayStart));
}

function formatTime(minute) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isDone(item) {
  return Boolean(state.completed[taskKey(item.id)]);
}

function isOverdue(item, index) {
  return !isDone(item) && chapterElapsedMinutes() > taskDueOffset(index);
}

function isUnlocked(index) {
  return index === 0 || chapterElapsedMinutes() >= taskDueOffset(index) - 60;
}

function visibleTasks() {
  return chapterTasks().filter((_, index) => isUnlocked(index));
}

function visiblePendingTasks() {
  return chapterTasks().filter((item, index) => isUnlocked(index) && !isDone(item));
}

function nextLockedPendingIndex() {
  return chapterTasks().findIndex((item, index) => !isDone(item) && !isUnlocked(index));
}

function shouldAutoFastForward() {
  return !state.ended && state.started && state.speed > 0 && visiblePendingTasks().length === 0;
}

function effectiveSpeed() {
  if (state.speed === 0) return 0;
  const pending = visiblePendingTasks().length;
  if (!pending) return shouldAutoFastForward() ? state.speed * 4 : state.speed;
  return Math.max(0.15, state.speed / (1 + pending * 0.75));
}

function chargeEndOfDayCosts() {
  const key = String(state.calendarDay);
  if (state.dayCostsCharged[key]) return;
  state.dayCostsCharged[key] = true;
  applyEffects({ cash: -2, dailyExpense: 1 });
}

function pushHistory(text) {
  state.history.unshift(`${formatTime(Math.min(state.minute, dayEnd))} ${text}`);
  state.history = state.history.slice(0, 30);
}

function showTicker(text) {
  const ticker = document.querySelector("#ticker");
  const item = document.createElement("span");
  item.className = "ticker-item";
  item.textContent = text;
  ticker.append(item);
  setTimeout(() => item.remove(), 8500);
}

function revealUnlockedEvents() {
  chapterTasks().forEach((item, index) => {
    const key = taskKey(item.id);
    if (!isUnlocked(index)) return;
    rememberTaskChat(item);
    if (state.seenTasks[key]) return;
    state.seenTasks[key] = true;
    const text = `新消息：${item.banner}`;
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
  const requestTitle = active.request.from;
  state.requests[taskKey(active.id)] = "accepted";
  forgetChat(requestTitle);
  state.activeChatTitle = active.phone.title;
  ensureTaskMessages(active);
  rememberTaskChat(active);
  pushHistory(active.request.accept);
  showTicker(active.request.accept);
  render();
}

function rejectRequest() {
  const active = task();
  if (!active.request) return;
  const key = taskKey(active.id);
  state.requests[key] = "rejected";
  state.completed[key] = true;
  state.replies[key] = "我没有通过好友申请。";
  appendChatMessages(active.request.from, [[active.request.from, active.request.note], ["我", "暂时不通过。"]]);
  rememberChat(active.request.from, { unread: "已拒绝", kind: "request" });
  applyEffects(active.request.rejectEffects || {});
  state.log.unshift(active.request.reject);
  pushHistory(active.request.reject);
  showTicker(active.request.reject);
  render();
}

function applyEffects(effects = {}) {
  Object.entries(effects).forEach(([key, delta]) => {
    state[key] = clamp(state[key] + delta);
  });
  state.dailyExpense = clamp(state.family);
}

function isHonestChoice(choice) {
  const text = `${choice.title} ${choice.reply}`;
  return /真鹅腿|原料|票据|停售|退款|道歉|送检|正规合同|暂停营业|公开账本/.test(text);
}

function applyHonestPressure(choice) {
  if (!isHonestChoice(choice)) return;
  state.honestDays += 1;
  applyEffects({ cash: -4, margin: -3, cost: 3, heat: -1 });

  if (/真鹅腿/.test(choice.title)) {
    applyEffects({ cash: -6, margin: -5, cost: 8, heat: -3 });
    state.log.unshift("真鹅腿成本太高，定价一涨，小程序下单人数明显少了。");
  }
}

function setFlag(choice) {
  if (!choice.flag) return;
  const [key, value] = choice.flag;
  state.flags[key] = value;
}

function checkEarlyEnding() {
  const { profit, risk, traffic } = getMetricSummary();

  if (profit <= 0) {
    renderEnding({
      name: "现金断档",
      body:
        "账上已经没有可周转的钱。订单还在响，炉火也还热，但供应商、退款、押金和家用同时压过来，小摊提前收摊。",
    });
    return true;
  }

  if (traffic <= 0) {
    renderEnding({
      name: "无人下单",
      body:
        "群里没有人再问几点到，也没人催辣和不辣。热度散了，口碑也没接住，摊位还在原地，订单却先消失了。",
    });
    return true;
  }

  if (risk >= 100) {
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
  chapterTasks().forEach((item, index) => {
    if (!isUnlocked(index)) return;
    if (isDone(item)) return;
    const key = taskKey(item.id);
    const due = taskDueOffset(index);
    const hits = state.overdueHits[key] || 0;
    const nextPenaltyAt = due + hits * 60;

    if (chapterElapsedMinutes() <= nextPenaltyAt) return;

    applyEffects({ reputation: -2, conscience: -1, documents: -2, risk: 4, heat: 3 });
    state.overdueHits[key] = hits + 1;
    state.log.unshift(`${item.banner} 超时未回复，截图和猜测开始自己长腿。`);
    state.log = state.log.slice(0, 12);
  });
}

function applyContinuousPressure() {
  if (state.minute % 45 !== 0) return;

  const pending = chapterTasks().filter((item, index) => isUnlocked(index) && !isDone(item)).length;
  const overdue = chapterTasks().filter((item, index) => isUnlocked(index) && isOverdue(item, index)).length;
  if (!pending) return;

  applyEffects({
    heat: pending + overdue,
    risk: overdue,
    reputation: overdue ? -1 : 0,
  });
}

function closeUnansweredTasks() {
  const pending = visiblePendingTasks().length;
  if (!pending) return;
  state.log.unshift(`还有 ${pending} 个红点没处理，时间继续压在当天。`);
  state.log = state.log.slice(0, 12);
}

function choose(index) {
  if (state.ended) return;
  const active = task();
  if (isDone(active)) return;
  const choice = active.choices[index];

  applyEffects(choice.effects);
  applyHonestPressure(choice);
  setFlag(choice);
  state.completed[taskKey(active.id)] = true;
  state.replies[taskKey(active.id)] = choice.reply;
  appendChatMessages(active.phone.title, [[replySpeakerForChat(active.phone.title), choice.reply]]);
  rememberTaskChat(active);
  state.log.unshift(choice.log);
  pushHistory(`我回复了：${choice.title}`);
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

  if (state.calendarDay >= campaignDays) {
    renderEnding(pickFinalEnding());
    return;
  }

  state.calendarDay += 1;
  syncDayIndex();
  state.activeTask = 0;
  state.activeChatTitle = "";
  state.minute = dayStart;
  pushHistory(`剧情推进到第 ${state.calendarDay} 天`);
  render();
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
    applyContinuousPressure();
    applyOverduePressure();
    if (visiblePendingTasks().length > 0) break;
  }

  const pendingAfter = visiblePendingTasks().map((item) => taskKey(item.id)).join("|");

  if (checkEarlyEnding()) return;

  if (state.minute >= dayEnd) {
    chargeEndOfDayCosts();
    if (checkEarlyEnding()) return;

    if (!canAdvanceFromCurrentDay()) {
      state.minute = dayEnd;
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
}

function skipToNextEvent() {
  if (state.ended) return;
  const nextLockedIndex = nextLockedPendingIndex();

  if (nextLockedIndex >= 0) {
    state.minute = dayStart + ((taskDueOffset(nextLockedIndex) - 60) % (dayEnd - dayStart));
    state.activeTask = nextLockedIndex;
    render();
    return;
  }

  if (allDone() && state.dayIndex < chapters.length - 1) {
    nextDay();
    return;
  }

  state.minute = dayEnd;
  if (checkEarlyEnding()) return;
  if (canAdvanceFromCurrentDay()) nextDay();
  else render();
}

function pickFinalEnding() {
  if (state.cash <= 10 && state.honestDays >= 5 && state.risk < 45) {
    return {
      name: "诚信破产",
      body:
        "我一直按真货、真票、真价格做，但队伍变短，成本变高，家用和退款压到最后。摊子没有塌房，只是安静地撑不下去了。",
    };
  }

  if (state.honestDays >= 7 && state.cash > 28 && state.risk < 42 && state.documents > 68) {
    return {
      name: "小摊长久",
      body:
        "我没有再靠含糊的招牌冲销量。真鹅腿贵，就少卖；鸭腿能卖，就明说。生意没有以前热闹，但每天都能把账说清楚。",
    };
  }

  if (state.documents > 74 && state.conscience > 58) {
    return {
      name: "明码标腿",
      body:
        "招牌少了传奇，多了原料、克重、批次和退款规则。生意变小以后，终于没人需要替你脑补诚信。",
    };
  }

  if (state.risk > 72) {
    return {
      name: "热搜里的样本",
      body:
        "你成了食品标识案例里最热闹的一页。每个人都说自己早看出来了，但当初转发排队视频的人一个也不少。",
    };
  }

  if (state.flags.studentRefund && state.conscience > 62 && state.risk < 45) {
    return {
      name: "重新写菜单",
      body:
        "你付出了退款和停业的代价，换来一张能说清楚的菜单。队伍没有以前长，但买卖终于回到买卖本身。",
    };
  }

  if (state.cash > 72 && state.conscience < 38) {
    return {
      name: "流量批发商",
      body:
        "钱留住了，人设也换了个壳。你不再纠结卖的是什么腿，因为镜头只需要热气、笑脸和一个能传播的标题。",
    };
  }

  if (state.reputation < 30) {
    return {
      name: "群聊黑名单",
      body:
        "学生群把你移出小程序团购，退款表比订购表更长。烟火气没有消失，只是大家终于学会先看标签。",
    };
  }

  if (state.heat > 75) {
    return {
      name: "永不下播",
      body:
        "你没有解决问题，只是把问题直播化。每一次澄清都像预告片，每一次道歉都带着小黄车。",
    };
  }

  return {
    name: "摊灯半明",
    body:
      "你没有彻底翻车，也没有真正翻身。几天之后，摊车还在路口，招牌上的每个字都比以前重了一点。",
  };
}

function renderStats() {
  const summary = getMetricSummary();
  const groups = [
    ["收益", summary.profit, metricDetails.profitDetails],
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
            <strong>${total}</strong>
          </div>
          <div class="meter ${title === "风险" ? "risk" : title === "流量" ? "heat" : "cash"}">
            <span style="width: ${total}%"></span>
          </div>
          <div class="stat-breakdown">${details}</div>
        </div>
      `;
    })
    .join("");
}

function renderMetrics() {
  const { profit, risk, traffic } = getMetricSummary();

  document.querySelector("#profitValue").style.width = `${profit}%`;
  document.querySelector("#riskValue").style.width = `${risk}%`;
  document.querySelector("#trafficValue").style.width = `${traffic}%`;

  Object.entries(metricDetails).forEach(([id, rows]) => {
    document.querySelector(`#${id}`).innerHTML = rows
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
          const last = info.last || "暂无消息";
          const avatarClass = info.kind === "request" ? "avatar-blue" : `avatar-${avatarTone(title)}`;
          return `
            <button class="chat-list-item ${active ? "active" : ""} ${overdue ? "overdue" : ""}" type="button" data-chat="${title}">
              <div class="avatar ${avatarClass}" aria-hidden="true"><span></span></div>
              <span class="chat-list-copy">
                <strong>${title}</strong>
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
  document.querySelector("#phoneTitle").textContent = title;
  document.querySelector("#unreadBadge").textContent = state.knownChats[title]?.unread || "已读";
  document.querySelector("#messages").innerHTML = messages.length
    ? messages
        .map(({ who, text }) => {
          const me = isOwnSpeaker(who);
          const avatarClass = me ? "avatar-me" : `avatar-${avatarTone(who)}`;
          return `
            <div class="message-row ${me ? "me" : ""}">
              <div class="avatar ${avatarClass}" aria-hidden="true">
                <span></span>
              </div>
              <div class="bubble-wrap">
                <span class="who">${who}</span>
                <div class="message-bubble">${text}</div>
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
}

function renderInactiveChoices(title) {
  document.querySelector("#phaseTag").textContent = "会话";
  document.querySelector("#eventTitle").textContent = title;
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
    document.querySelector("#phaseTag").textContent = current.phase;
    document.querySelector("#eventTitle").textContent = current.title;
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
    document.querySelector("#phoneTitle").textContent = active.request.from;
    document.querySelector("#unreadBadge").textContent = "申请";
    document.querySelector("#messages").innerHTML = `
      <div class="friend-request">
        <div class="avatar avatar-blue" aria-hidden="true"><span></span></div>
        <strong>${active.request.from}</strong>
        <p>${active.request.note}</p>
      </div>
    `;
    return;
  }

  ensureTaskMessages(active);
  const messages = state.chatHistory[active.phone.title] || [];

  document.querySelector("#phoneTitle").textContent = active.phone.title;
  document.querySelector("#unreadBadge").textContent = isDone(active) ? "已读" : active.phone.unread;
  document.querySelector("#messages").innerHTML = messages
    .map(({ who, text }) => {
      const me = isOwnSpeaker(who);
      const avatarClass = me ? "avatar-me" : `avatar-${avatarTone(who)}`;
      return `
        <div class="message-row ${me ? "me" : ""}">
          <div class="avatar ${avatarClass}" aria-hidden="true">
            <span></span>
          </div>
          <div class="bubble-wrap">
            <span class="who">${who}</span>
            <div class="message-bubble">${text}</div>
          </div>
        </div>
      `;
    })
    .join("");
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
                <span class="choice-title">${choice.title}</span>
                <span class="choice-desc">${choice.desc}</span>
              </span>
              <span class="choice-cost">${choice.cost}</span>
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
  document.querySelector("#historyList").innerHTML = entries.map((item) => `<li>${item}</li>`).join("");
}

function renderProgress() {
  const visiblePending = visibleTasks().filter((item) => !isDone(item)).length;
  const locked = chapterTasks().length - visibleTasks().length;
  const dayProgress = ((Math.min(state.minute, dayEnd) - dayStart) / (dayEnd - dayStart)) * 100;
  document.querySelector("#clockLabel").textContent = formatTime(Math.min(state.minute, dayEnd));
  document.querySelector("#dayStatus").textContent = visiblePending
    ? "有新消息待处理"
    : locked
      ? "营业中"
      : "今日收摊中";
  document.querySelector("#dayProgressBar").style.width = `${clamp(dayProgress)}%`;
  document.querySelector("#settingsDayProgressBar").style.width = `${clamp(dayProgress)}%`;
  document.querySelector("#spreadProgressBar").style.width = `${clamp((state.heat + state.risk) / 2)}%`;
  document.querySelectorAll("[data-speed]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === state.speed);
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
  revealUnlockedEvents();
  if (!isUnlocked(state.activeTask)) {
    const firstVisible = chapterTasks().findIndex((_, index) => isUnlocked(index));
    state.activeTask = Math.max(0, firstVisible);
  }
  const active = task();
  document.querySelector(".reply-panel").classList.remove("ending");
  document.querySelector("#dayLabel").textContent = `第 ${state.calendarDay} / ${campaignDays} 天`;
  document.querySelector("#eventTitle").textContent = current.title;
  document.querySelector("#phaseTag").textContent = active.phase;
  document.querySelector("#eventBody").textContent = "";

  renderStats();
  renderMetrics();
  renderBanners();
  renderPhoneLayer();
  renderLog();
  renderHistory();
  renderProgress();
}

function endingAnalysisRows(ending) {
  const summary = getMetricSummary();
  const handled = Object.keys(state.completed).length;
  const honest = state.honestDays;
  const rows = [
    ["结局", ending.name],
    ["经营结果", `收益 ${summary.profit}，风险 ${summary.risk}，流量 ${summary.traffic}`],
    ["处理记录", `我处理了 ${handled} 个关键对话，其中偏透明/送检/退款的选择约 ${honest} 次。`],
  ];

  if (state.flags.clearLabel) rows.push(["菜单", "我曾经尝试把商品名和原料写清楚，后续争议更容易解释。"]);
  if (state.flags.shadyStock) rows.push(["进货", "我接过含糊或低价批次，利润变厚，但票据和食品疑点也被放大。"]);
  if (state.flags.studentRefund) rows.push(["退款", "我打开过退款口，现金压力变大，但监管和舆论风险下降。"]);
  if (state.flags.prAgency) rows.push(["公关", "我用过包装叙事的方式处理舆论，热度可能短降，但信任没有真正恢复。"]);
  if (state.risk > 65) rows.push(["风险", "风险指标过高，说明我很多时候在用话术拖延事实核对。"]);
  if (state.cash < 18) rows.push(["现金", "现金太低，说明诚信路线也需要重新设计定价和规模，否则好生意也会被成本压垮。"]);
  if (state.reputation > 65 && state.documents > 65) rows.push(["信任", "口碑和票据都还站得住，说明小摊可以少一点传奇，多一点明账。"]);

  return rows;
}

function renderEnding(ending) {
  state.ended = true;
  state.activeChatTitle = "";
  document.querySelector("#dayLabel").textContent = `第 ${state.calendarDay} / ${campaignDays} 天`;
  document.querySelector("#dayStatus").textContent = "经营结束";
  document.querySelector("#clockLabel").textContent = formatTime(Math.min(state.minute, dayEnd));
  document.querySelector("#taskBanners").hidden = true;
  document.querySelector("#conversationView").hidden = true;
  document.querySelector("#endingView").hidden = false;
  document.querySelector("#endingTitle").textContent = ending.name;
  document.querySelector("#endingBody").textContent = ending.body;
  document.querySelector("#endingAnalysis").innerHTML = endingAnalysisRows(ending)
    .map(([label, text]) => `<div><strong>${label}</strong><span>${text}</span></div>`)
    .join("");
  renderStats();
  renderMetrics();
  renderLog();
  renderHistory();
}

function resetGame() {
  state = structuredClone(initialState);
  document.querySelector("#introOverlay").classList.remove("hidden");
  render();
}

document.querySelector("#resetButton").addEventListener("click", resetGame);
document.querySelector("#backToChatsButton").addEventListener("click", () => {
  state.activeChatTitle = "";
  render();
});
document.querySelector("#againButton").addEventListener("click", resetGame);
document.querySelector("#settingsButton").addEventListener("click", () => {
  document.querySelector("#settingsPanel").hidden = false;
});
document.querySelector("#closeSettingsButton").addEventListener("click", () => {
  document.querySelector("#settingsPanel").hidden = true;
});
document.querySelectorAll("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    renderProgress();
  });
});
document.querySelector("#startButton").addEventListener("click", () => {
  state.started = true;
  pushHistory("我开始营业");
  document.querySelector("#introOverlay").classList.add("hidden");
  render();
});
render();
timerId = setInterval(tick, tickMs);
