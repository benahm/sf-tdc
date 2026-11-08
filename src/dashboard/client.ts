/**
 * Script of the dashboard, run in the browser. Plain JavaScript inside a template string: no backticks, no
 * interpolation, no backslashes. Every string from the data goes through textContent, never through HTML.
 */
export const CLIENT = `
"use strict";
const data = JSON.parse(document.getElementById("tdc-data").textContent);
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));
const date = (s) => new Date(s).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
const money = (amount, currency) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return fmt(amount) + " " + currency;
  }
};
const text = (id, value) => {
  $(id).textContent = value;
};
const el = (tag, value, className) => {
  const e = document.createElement(tag);
  if (value !== undefined) e.textContent = value;
  if (className) e.className = className;
  return e;
};
const coin = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  svg.setAttribute("class", "coinicon");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#tdc-coin");
  use.setAttribute("width", "64");
  use.setAttribute("height", "64");
  svg.append(use);
  return svg;
};
const withCoin = (node) => {
  node.append(" ", coin());
  return node;
};
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const all = [...data.findings, ...data.declared];
const measured = (f) => f.source === "code-analyzer";
let period = 0,
  page = 0,
  eventLimit = 30;

/* Tabs and theme */
const TABS = ["overview", "debts", "collectors", "activity"];
function tab(name) {
  for (const n of TABS) $(n).hidden = n !== name;
  document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === name)));
  if (name === "overview") draw();
}
document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
let light = window.matchMedia("(prefers-color-scheme: light)").matches;
function theme() {
  document.documentElement.dataset.theme = light ? "light" : "dark";
  text("theme", light ? "Dark theme" : "Light theme");
}
theme();
$("theme").onclick = () => {
  light = !light;
  theme();
};

/* Header */
text("project", data.project);
text("branch", data.branch + (data.commit ? " · " + data.commit : ""));
text("generated", "Statement date · " + date(data.generatedAt));
text("debtcount", "(" + all.length + ")");
text("collectorcount", "(" + data.players.length + ")");

/* Statement of account */
function countUp(node, value) {
  if (calm || value === 0) {
    node.textContent = fmt(value);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / 900, 1);
    node.textContent = fmt(Math.round(value * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
    else node.textContent = fmt(value);
  };
  requestAnimationFrame(step);
}
countUp($("outstandingvalue"), data.debt);
if (data.debt === 0) $("outstanding").classList.add("zero");
text(
  "price",
  "≈ " + fmt(data.price.manDays) + " workdays · " + money(data.price.amount, data.price.currency) + " at your daily rate"
);
(function drift() {
  const node = $("drift");
  if (data.committedDebt === undefined) {
    node.textContent = data.history.length ? "" : "Ledger not committed yet · commit it to open the books";
    node.hidden = !node.textContent;
    return;
  }
  const delta = data.debt - data.committedDebt;
  if (!delta) {
    node.hidden = true;
    return;
  }
  node.className = "drift " + (delta > 0 ? "up" : "down");
  node.hidden = false;
  node.textContent =
    delta > 0
      ? signed(delta) + " TDC of new debt not committed yet"
      : signed(delta) + " TDC repaid, not committed yet · commit to collect " + fmt(-delta) + " coins";
})();
(function payoff() {
  const f = data.forecast,
    stamp = $("stamp");
  const setStamp = (label, tone) => {
    stamp.textContent = label;
    stamp.className = "stamp " + tone;
    stamp.hidden = false;
  };
  if (data.debt === 0) {
    text("freedom", "Today");
    text("pace", "No measured debt. Keep the books clean.");
    setStamp("Paid in full", "good");
    return;
  }
  if (!f) {
    text("freedom", "Not enough history");
    text("pace", "A forecast needs at least two commits in the same measurement baseline.");
    return;
  }
  if (f.payoffDate) {
    text("freedom", date(f.payoffDate));
    text("pace", "Repaying " + fmt(f.paidPerDay) + " TDC/day since the latest baseline.");
  } else if (f.paidPerDay < 0) {
    text("freedom", "Never, at this pace");
    text("pace", "The debt grows by " + fmt(-f.paidPerDay) + " TDC/day since the latest baseline.");
  } else {
    text("freedom", "Never, at this pace");
    text("pace", "The debt is stable since the latest baseline.");
  }
  if (f.goal) {
    if (f.goal.onTrack) setStamp("On track", "good");
    else setStamp(Date.parse(f.goal.date) < Date.parse(data.generatedAt) ? "Overdue" : "Behind", "bad");
  } else if (f.paidPerDay > 0) setStamp("Repaying", "good");
  else if (f.paidPerDay < 0) setStamp("Accruing", "bad");
})();

/* Credits and debits of the period, and the chart */
function history() {
  return data.history.filter((e) => !period || Date.parse(e.date) >= Date.parse(data.generatedAt) - period * 86400000);
}
const ns = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, value) {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (value !== undefined) e.textContent = value;
  return e;
}
function totals(events) {
  const paid = events.reduce((s, e) => s + e.paid, 0),
    created = events.reduce((s, e) => s + e.created, 0),
    coins = events.reduce((s, e) => s + e.coins, 0);
  text("paid", "−" + fmt(paid));
  text("created", "+" + fmt(created));
  const net = created - paid;
  text("net", signed(net));
  $("net").className = "value number " + (net > 0 ? "created" : net < 0 ? "paid" : "");
  text("coins", signed(coins));
  $("coins").append(" ", coin());
  $("coins").className = "value number " + (coins < 0 ? "created" : "gold");
}
function draw() {
  const events = history();
  totals(events);
  const host = $("chart");
  host.replaceChildren();
  if (!events.length) {
    host.append(el("p", "No committed ledger in this period. Commit a ledger to start tracking repayments.", "empty"));
    return;
  }
  const w = Math.max(host.clientWidth, 250),
    h = 260,
    left = 58,
    right = 22,
    top = 28,
    bottom = 42,
    max = Math.max(events.reduce((m, e) => Math.max(m, e.debt), 1), data.goal ? data.goal.debt : 0) * 1.12,
    x = (i) => left + (w - left - right) * (events.length === 1 ? 0.5 : i / (events.length - 1)),
    y = (n) => h - bottom - ((h - top - bottom) * n) / max;
  const svg = svgEl("svg", {
    viewBox: "0 0 " + w + " " + h,
    class: "chart",
    role: "img",
    "aria-label": "Committed technical debt in TDC, in commit order. Baseline changes interrupt the line.",
  });
  svg.append(svgEl("title", {}, "Debt by commit · TDC"));
  for (let i = 0; i < 4; i++) {
    const v = (max * i) / 3,
      yy = y(v);
    svg.append(svgEl("line", { x1: left, y1: yy, x2: w - right, y2: yy, class: "grid" }));
    svg.append(
      svgEl(
        "text",
        { x: left - 9, y: yy + 4, "text-anchor": "end" },
        new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)
      )
    );
  }
  svg.append(svgEl("text", { x: left, y: 13 }, "TDC"));
  if (data.goal) {
    svg.append(
      svgEl("line", { x1: left, y1: y(data.goal.debt), x2: w - right, y2: y(data.goal.debt), class: "goal" })
    );
  }
  let points = [];
  function segment() {
    if (points.length) {
      const floor = h - bottom,
        first = points[0],
        last = points[points.length - 1];
      const area = [first[0] + "," + floor, ...points.map((p) => p.join(",")), last[0] + "," + floor];
      svg.append(svgEl("polygon", { points: area.join(" "), class: "area" }));
      svg.append(svgEl("polyline", { points: points.map((p) => p.join(",")).join(" "), class: "debt" }));
    }
    points = [];
  }
  events.forEach((e, i) => {
    if (e.kind !== "scored") {
      segment();
      svg.append(svgEl("line", { x1: x(i), y1: top, x2: x(i), y2: h - bottom, class: "baseline" }));
    }
    points.push([x(i), y(e.debt)]);
  });
  segment();
  events.forEach((e, i) => {
    const c = svgEl("circle", { cx: x(i), cy: y(e.debt), r: events.length > 150 ? 2 : 4, fill: "var(--gold)" });
    c.append(
      svgEl("title", {}, date(e.date) + " · " + e.sha.slice(0, 7) + " · " + fmt(e.debt) + " TDC · " + e.subject)
    );
    svg.append(c);
  });
  const labels = w < 440 ? [0, events.length - 1] : [0, Math.floor((events.length - 1) / 2), events.length - 1];
  [...new Set(labels)].forEach((i) =>
    svg.append(
      svgEl(
        "text",
        {
          x: x(i),
          y: h - 12,
          "text-anchor":
            events.length === 1 ? "middle" : i === 0 ? "start" : i === events.length - 1 ? "end" : "middle",
        },
        date(events[i].date)
      )
    )
  );
  host.append(svg);
}
document.querySelectorAll("[data-days]").forEach(
  (b) =>
    (b.onclick = () => {
      period = Number(b.dataset.days);
      document.querySelectorAll("[data-days]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      draw();
    })
);
new ResizeObserver(() => {
  if (!$("overview").hidden) draw();
}).observe($("chart"));
draw();

/* Collection notices: the files that owe the most */
const owed = new Map();
data.findings.forEach((f) => {
  const o = owed.get(f.file) || { cost: 0, count: 0 };
  o.cost += f.cost;
  o.count++;
  owed.set(f.file, o);
});
const debtors = [...owed].sort((a, b) => b[1].cost - a[1].cost || a[0].localeCompare(b[0])).slice(0, 5);
if (!debtors.length) $("files").append(el("p", "No file owes anything. Keep the books clean.", "empty"));
debtors.forEach(([file, o], i) => {
  const b = el("button", undefined, "debtor");
  b.type = "button";
  const row = el("div", undefined, "row");
  const who = el("div", undefined, "who");
  who.append(el("small", "Notice #" + (i + 1) + " · " + o.count + (o.count === 1 ? " finding" : " findings")));
  who.append(el("div", file, "mono"));
  row.append(who, el("span", "owes " + fmt(o.cost) + " TDC", "owed number"));
  const hp = el("div", undefined, "hp"),
    track = el("div", undefined, "track"),
    fill = el("div", undefined, "fill");
  fill.style.width = (o.cost / Math.max(debtors[0][1].cost, 1)) * 100 + "%";
  track.append(fill);
  hp.append(el("span", "HP"), track);
  b.append(row, hp);
  b.onclick = () => {
    $("search").value = file;
    $("source").value = "code-analyzer";
    $("engine").value = "all";
    page = 0;
    renderRows();
    tab("debts");
  };
  $("files").append(b);
});

/* Bounties: the most expensive debts, worth as many coins once repaid */
const bounties = [...data.findings].sort((a, b) => b.cost - a.cost || a.file.localeCompare(b.file)).slice(0, 4);
if (!bounties.length) $("next").append(el("p", "No bounty left. Every measured debt is repaid.", "empty"));
bounties.forEach((f) => {
  const b = el("button", undefined, "bounty");
  b.type = "button";
  const reward = el("div", undefined, "reward");
  reward.append(withCoin(el("strong", "+" + fmt(f.cost), "number")), el("small", "bounty"));
  b.append(el("p", f.rule, "mono"), reward, el("small", f.file));
  b.onclick = () => showDebt(f);
  $("next").append(b);
});

/* Objective: progress toward the goal */
if (data.goal) {
  text("goaltitle", fmt(data.goal.debt) + " TDC by " + date(data.goal.date));
  let progress;
  if (data.forecast && data.forecast.goal) progress = data.forecast.goal.progress;
  else {
    const lastBaseline = [...data.history].reverse().find((e) => e.kind !== "scored");
    const start = lastBaseline ? lastBaseline.debt : data.debt;
    progress =
      start > data.goal.debt
        ? Math.max(0, Math.min(1, (start - data.debt) / (start - data.goal.debt)))
        : data.debt <= data.goal.debt
        ? 1
        : 0;
  }
  text(
    "goaltext",
    data.debt <= data.goal.debt
      ? "Goal reached. Time to set a new one."
      : fmt(data.debt - data.goal.debt) +
          " TDC left to save · " +
          Math.round(progress * 100) +
          "% of the way since the latest baseline."
  );
  if (data.forecast && data.forecast.goal)
    text("forecast", "Projected balance on the goal date: " + fmt(data.forecast.goal.projectedDebt) + " TDC.");
  const slot = $("goaltrack");
  slot.setAttribute("role", "progressbar");
  slot.setAttribute("aria-label", "Progress from the latest baseline to the goal");
  slot.setAttribute("aria-valuemin", "0");
  slot.setAttribute("aria-valuemax", "100");
  slot.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  [
    [0.25, "25%"],
    [0.5, "Halfway"],
    [0.75, "75%"],
    [1, "🎉 Goal"],
  ].forEach(([at, label]) => {
    const m = el("span", (progress >= at ? "✓ " : "") + label, "milestone" + (progress >= at ? " reached" : ""));
    m.style.left = at * 100 + "%";
    if (at === 1) m.style.transform = "translateX(-100%)";
    m.setAttribute("aria-hidden", "true");
    slot.append(m);
  });
  requestAnimationFrame(() => ($("goalprogress").style.width = progress * 100 + "%"));
} else {
  text("goaltitle", "Give the debt a finish line.");
  text("goaltext", "Set goal.debt and goal.date with sf tdc init.");
  $("goaltrack").hidden = true;
}

/* Debts */
const keys = [...new Set(all.map((f) => f.rule.split(":")[0]))].sort();
keys.forEach((k) => {
  const o = el("option", k);
  o.value = k;
  $("engine").append(o);
});
text("declaredtotal", fmt(data.declared.reduce((s, d) => s + d.cost, 0)) + " declared TDC · outside balance");
function showDebt(f) {
  text("detailtitle", f.problem);
  const body = $("detailbody");
  body.replaceChildren();
  body.append(
    el("span", measured(f) ? "Measured debt" : "Declared · " + f.source, "tag"),
    el("span", fmt(f.cost) + " TDC", "tag number"),
    el("span", f.rule, "tag mono")
  );
  if (f.severity) body.append(el("span", f.severity, "tag"));
  body.append(
    el("p", f.file + (f.line ? ":" + f.line : ""), "mono"),
    el("pre", f.snippet || "No source snippet available."),
    el("p", "Finding ID: " + f.id, "muted mono")
  );
  body.append(
    measured(f)
      ? el("p", "Bounty: +" + fmt(f.cost) + " coins for the commit that repays it.", "gold")
      : el("p", "No bounty: declared debt is outside the ledger and coin calculations.", "muted")
  );
  const command = "sf tdc check --id " + f.id;
  body.append(el("pre", command));
  const copy = el("button", "Copy verification command");
  copy.type = "button";
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(command);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select and copy the command above";
    }
  };
  body.append(copy);
  $("detail").showModal();
}
$("close").onclick = () => $("detail").close();
function renderRows() {
  const q = $("search").value.toLowerCase(),
    source = $("source").value,
    engine = $("engine").value;
  const matching = all
    .filter(
      (f) =>
        (source === "all" || f.source === source) &&
        (engine === "all" || f.rule.split(":")[0] === engine) &&
        [f.file, f.rule, f.problem, f.id, f.category || ""].some((s) => s.toLowerCase().includes(q))
    )
    .sort((a, b) =>
      $("sort").value === "file"
        ? a.file.localeCompare(b.file) || b.cost - a.cost
        : b.cost - a.cost || a.file.localeCompare(b.file)
    );
  const pages = Math.max(1, Math.ceil(matching.length / 50));
  page = Math.min(page, pages - 1);
  $("rows").replaceChildren();
  matching.slice(page * 50, (page + 1) * 50).forEach((f) => {
    const row = el("tr"),
      place = el("td"),
      b = el("button", f.problem);
    b.type = "button";
    b.onclick = () => showDebt(f);
    place.append(b, el("p", f.file + (f.line ? ":" + f.line : ""), "muted mono"));
    const rule = el("td");
    rule.append(el("p", f.rule, "mono"), el("small", f.source));
    const cost = el("td", undefined, "num");
    cost.append(el("span", fmt(f.cost), "number gold"));
    row.append(place, rule, cost);
    $("rows").append(row);
  });
  if (!matching.length) {
    const td = el("td", "No debts match these filters.", "empty");
    td.colSpan = 3;
    const tr = el("tr");
    tr.append(td);
    $("rows").append(tr);
  }
  text(
    "results",
    fmt(matching.length) +
      " findings · " +
      fmt(matching.filter(measured).reduce((s, f) => s + f.cost, 0)) +
      " measured TDC · " +
      fmt(matching.filter((f) => !measured(f)).reduce((s, f) => s + f.cost, 0)) +
      " declared TDC"
  );
  text("page", page + 1 + " / " + pages);
  $("previous").disabled = page === 0;
  $("nextpage").disabled = page === pages - 1;
}
for (const id of ["search", "source", "engine", "sort"])
  $(id).addEventListener(id === "search" ? "input" : "change", () => {
    page = 0;
    renderRows();
  });
$("previous").onclick = () => {
  page--;
  renderRows();
};
$("nextpage").onclick = () => {
  page++;
  renderRows();
};
renderRows();

/* Collectors */
(function collectors() {
  if (!data.players.length) {
    $("podium").append(
      el("p", "No collector yet. Commit a change that repays debt to enter the leaderboard.", "empty")
    );
    $("players").hidden = true;
  }
  const medals = ["🥇", "🥈", "🥉"];
  data.players.slice(0, 3).forEach((p, i) => {
    const step = el("div", undefined, "step p" + (i + 1));
    step.style.order = String([2, 1, 3][i]);
    step.append(
      el("div", medals[i], "medal"),
      el("h3", p.author),
      el("small", p.rank),
      withCoin(el("div", signed(p.coins), "coins number"))
    );
    $("podium").append(step);
  });
  data.players.forEach((p, i) => {
    const row = el("tr");
    row.append(el("td", String(i + 1), "number"));
    const who = el("td");
    who.append(el("strong", p.author), el("br"), el("small", p.commits + (p.commits === 1 ? " commit" : " commits")));
    const rank = el("td", undefined, "rankbar");
    rank.append(el("div", p.rank));
    if (p.nextRank) {
      const track = el("div", undefined, "track"),
        fill = el("div", undefined, "fill");
      fill.style.width = Math.round(Math.min(Math.max(p.nextRank.progress, 0), 1) * 100) + "%";
      track.append(fill);
      rank.append(track, el("small", fmt(p.nextRank.coinsToGo) + " coins to " + p.nextRank.name));
    } else rank.append(el("small", "Top rank reached"));
    row.append(
      who,
      rank,
      el("td", "−" + fmt(p.paid), "num paid"),
      el("td", "+" + fmt(p.created), "num created"),
      el("td", signed(p.coins), "num number " + (p.coins < 0 ? "created" : "gold"))
    );
    $("playerrows").append(row);
  });
  data.ranks.forEach((r) => $("ladder").append(withCoin(el("span", r.name + " · " + fmt(r.minCoins), "tag"))));
})();

/* Activity: the statement of every committed ledger */
function showCommit(e) {
  text("detailtitle", e.subject);
  const body = $("detailbody");
  body.replaceChildren();
  body.append(
    el("p", e.sha, "mono"),
    el("p", (e.author ? e.author + " · " : "") + date(e.date)),
    el("p", "Balance after commit: " + fmt(e.debt) + " TDC")
  );
  if (e.kind !== "scored")
    body.append(el("p", "Portfolio revaluation. No repayments, new debt or coins are scored.", "notice"));
  else body.append(withCoin(el("p", "Coins: " + signed(e.coins), e.coins < 0 ? "created" : "gold")));
  for (const [label, list] of [
    ["Repaid", e.paidFindings],
    ["New debt", e.createdFindings],
  ]) {
    body.append(el("h3", label + " · " + list.length));
    list
      .slice(0, 100)
      .forEach((f) => body.append(el("p", f.rule + " · " + f.file + " · " + fmt(f.cost) + " TDC", "mono")));
    if (list.length > 100) body.append(el("p", "Showing the first 100 findings."));
  }
  body.append(
    el("p", fmt(e.deleted) + " TDC written off with deleted files · " + e.moved + " findings moved.", "muted")
  );
  $("detail").showModal();
}
function renderEvents() {
  $("events").replaceChildren();
  if (!data.history.length) {
    const td = el("td", "No committed ledger yet. Run sf tdc scan and commit the ledger.", "empty");
    td.colSpan = 6;
    const tr = el("tr");
    tr.append(td);
    $("events").append(tr);
  }
  [...data.history]
    .reverse()
    .slice(0, eventLimit)
    .forEach((e) => {
      const scored = e.kind === "scored";
      const row = el("tr", undefined, scored ? "" : "revaluation");
      const info = el("td"),
        b = el("button", e.subject);
      b.type = "button";
      b.onclick = () => showCommit(e);
      info.append(b, el("br"), el("small", (e.author ? e.author + " · " : "") + e.sha.slice(0, 7)));
      if (!scored)
        info.append(
          el(
            "p",
            e.kind === "baseline"
              ? "Account opened · initial baseline · no coins"
              : "Portfolio revaluation · rules or engines changed · no coins",
            "gold"
          )
        );
      if (e.deleted) info.append(el("p", fmt(e.deleted) + " TDC written off with deleted files", "muted"));
      row.append(
        el("td", date(e.date), "number"),
        info,
        el("td", scored && e.created ? "+" + fmt(e.created) : "—", "num " + (scored && e.created ? "created" : "muted")),
        el("td", scored && e.paid ? "−" + fmt(e.paid) : "—", "num " + (scored && e.paid ? "paid" : "muted")),
        el("td", fmt(e.debt), "num number"),
        (scored && e.coins ? withCoin : (n) => n)(
          el(
            "td",
            scored && e.coins ? signed(e.coins) : "—",
            "num number " + (!scored || !e.coins ? "muted" : e.coins < 0 ? "created" : "gold")
          )
        )
      );
      $("events").append(row);
    });
  $("moreevents").hidden = eventLimit >= data.history.length;
}
$("moreevents").onclick = () => {
  eventLimit += 30;
  renderEvents();
};
renderEvents();

/* Coin rain when the latest committed ledger repaid debt */
(function rain() {
  const last = data.history[data.history.length - 1];
  if (calm || !last || last.kind !== "scored" || last.paid <= last.created) return;
  const box = el("div", undefined, "rain");
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 18; i++) {
    const c = el("span");
    c.append(coin());
    c.style.left = Math.random() * 100 + "%";
    c.style.animationDuration = 2 + Math.random() * 2 + "s";
    c.style.animationDelay = Math.random() * 0.8 + "s";
    box.append(c);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 5000);
})();
`;
