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
const measured = (f) => f.source === "code-analyzer";
const measuredFinding = (f) => ({ ...f, ...data.rules[f.rule], source: "code-analyzer" });
/* The category of the rule from the catalog, or its engine when the catalog is missing */
const groupOf = (f) => f.category || f.rule.split(":")[0];
/* A path that wraps at its slashes, the file name standing out from its folders */
function pathNode(file, line) {
  const cut = file.lastIndexOf("/"),
    node = el("span", undefined, "path mono");
  if (cut >= 0) {
    const dir = el("span", undefined, "dir");
    file
      .slice(0, cut)
      .split("/")
      .forEach((part) => dir.append(part + "/", document.createElement("wbr")));
    node.append(dir);
  }
  node.append(el("span", file.slice(cut + 1) + (line ? ":" + line : ""), "base"));
  return node;
}
const SEVERITIES = ["Critical", "High", "Moderate", "Low", "Info"];
const severityNode = (severity) =>
  el("span", severity, "sev" + (SEVERITIES.includes(severity) ? " sev-" + severity.toLowerCase() : ""));
const plural = (n, word) => fmt(n) + " " + word + (n === 1 ? "" : "s");
/* Rows open their detail from anywhere; the button inside keeps them reachable from the keyboard */
function clickable(row, open) {
  row.classList.add("click");
  row.onclick = open;
}
let period = 0,
  page = 0,
  eventLimit = 30;

/* Tabs and theme */
const TABS = ["overview", "debts", "collectors", "activity"];
/* The browser may refuse storage to a local file: the report works without it */
const remember = (key, value) => {
  try {
    localStorage.setItem("tdc-" + key, value);
  } catch {}
};
const recall = (key) => {
  try {
    return localStorage.getItem("tdc-" + key);
  } catch {
    return null;
  }
};
const fromHash = () => location.hash.slice(2);
function tab(name) {
  for (const n of TABS) $(n).hidden = n !== name;
  document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === name)));
  /* "#/debts", not "#debts": the browser would scroll the section under the sticky bar */
  if (fromHash() !== name && (name !== "overview" || location.hash)) window.history.replaceState(null, "", "#/" + name);
  window.scrollTo(0, 0);
  if (name === "overview") draw();
  if (name === "debts") renderRows();
}
document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
window.addEventListener("hashchange", () => {
  if (TABS.includes(fromHash())) tab(fromHash());
});
const saved = recall("theme");
let light = saved ? saved === "light" : window.matchMedia("(prefers-color-scheme: light)").matches;
const themeToggle = $("theme");
function theme() {
  document.documentElement.dataset.theme = light ? "light" : "dark";
  themeToggle.setAttribute("aria-pressed", String(!light));
  themeToggle.title = light ? "Switch to dark theme" : "Switch to light theme";
}
theme();
themeToggle.onclick = () => {
  light = !light;
  remember("theme", light ? "light" : "dark");
  theme();
};

/* Header */
text("project", data.project);
text("branch", data.branch + (data.commit ? " · " + data.commit : ""));
text("generated", "Statement date · " + date(data.generatedAt));
text("debtcount", fmt(data.count));
text("collectorcount", fmt(data.players.length));

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
text("initialcount", plural(data.measuredCount, "measured finding") + " in " + plural(data.affectedFiles, "file"));
/* The scored commits of the last days: what the team repaid and created, net */
const sinceDays = (days) => Date.parse(data.generatedAt) - days * 86400000;
const scoredSince = (days) => data.history.filter((e) => e.kind === "scored" && (!days || Date.parse(e.date) >= sinceDays(days)));
(function trend() {
  const recent = scoredSince(30),
    net = recent.reduce((s, e) => s + e.created - e.paid, 0),
    node = $("trend");
  if (!recent.length || !net) return;
  node.className = "drift " + (net > 0 ? "up" : "down");
  node.textContent = (net > 0 ? "+" + fmt(net) + " TDC of new debt" : fmt(-net) + " TDC repaid") + " net over 30 days";
  node.hidden = false;
})();
(function drift() {
  if (!data.forecast) return;
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
(function baseline() {
  if (data.forecast) return;
  text("scopedirs", data.sourceDirs.join(", "));
  text("scopefiles", plural(data.affectedFiles, "file") + " with findings");
  text("baselinenext", data.committedDebt === undefined
    ? "Commit the ledger to record this baseline."
    : "Commit another comparable ledger to see repayment trends.");
  const list = $("toprules");
  if (!data.topRules.length) {
    list.replaceWith(el("p", "No measured debt.", "muted"));
    return;
  }
  for (const [rule, total] of data.topRules) {
    const row = el("li");
    const description = el("div");
    description.append(el("strong", rule, "path mono"), el("small", plural(total.count, "finding")));
    row.append(description, el("span", fmt(total.cost) + " TDC", "gold number"));
    list.append(row);
  }
})();
(function payoff() {
  const f = data.forecast,
    stamp = $("stamp");
  if (!f) return;
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
function visibleHistory() {
  return data.history.filter((e) => !period || Date.parse(e.date) >= Date.parse(data.generatedAt) - period * 86400000);
}
const DAY = 86400000;
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
  text("paid", paid ? "−" + fmt(paid) : "0");
  text("created", created ? "+" + fmt(created) : "0");
  const scored = events.filter((e) => e.kind === "scored"),
    repaying = scored.filter((e) => e.paid > e.created).length;
  text("repaying", fmt(repaying) + " / " + fmt(scored.length));
  $("repaying").className =
    "value number " + (!scored.length ? "" : repaying * 2 >= scored.length ? "paid" : "created");
  text("coins", signed(coins));
  $("coins").append(" ", coin());
  $("coins").className = "value number " + (coins < 0 ? "created" : "gold");
}
const compact = (n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
/* A round step for about four graduations */
function niceStep(max) {
  const raw = max / 4,
    mag = Math.pow(10, Math.floor(Math.log10(raw))),
    n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
function draw() {
  if (!data.forecast) return;
  const events = visibleHistory();
  totals(events);
  const host = $("chart");
  host.replaceChildren();
  $("legend").hidden = !events.length;
  $("legendgoal").hidden = !data.goal;
  if (!events.length) {
    host.append(el("p", "No committed ledger in this period. Commit a ledger to start tracking repayments.", "empty"));
    return;
  }
  /* Time on the x axis: a commit date earlier than the previous one (rebase) stays in commit order */
  const times = [];
  events.forEach((e, i) => times.push(Math.max(Date.parse(e.date), i ? times[i - 1] : 0)));
  const lastIndex = events.length - 1,
    last = events[lastIndex],
    firstT = times[0],
    lastT = times[lastIndex],
    f = data.forecast,
    /* The forecast starts today from the last committed debt, at the pace since the latest baseline */
    start = Math.max(Date.parse(data.generatedAt), lastT),
    goalT = data.goal ? Date.parse(data.goal.date) : NaN,
    payoffT = f.payoffDate ? Math.max(Date.parse(f.payoffDate), start) : Infinity,
    project = last.debt > 0,
    /* Up to the goal date, or as far ahead as the history looks back: a payoff in ten years must not flatten it */
    endT = goalT > start ? goalT : Math.min(payoffT, start + Math.max(lastT - firstT, 30 * DAY)),
    projected = (t) => Math.max(last.debt - (f.paidPerDay * (t - start)) / DAY, 0),
    tMax = project ? endT : lastT;
  $("legendprojection").hidden = !project;
  const w = Math.max(host.clientWidth, 250),
    h = 280,
    left = 52,
    right = 16,
    top = 26,
    bottom = 38,
    floor = h - bottom,
    peak = Math.max(
      events.reduce((m, e) => Math.max(m, e.debt), 1),
      data.goal ? data.goal.debt : 0,
      project ? projected(endT) : 0
    ),
    step = niceStep(peak * 1.05),
    max = Math.ceil((peak * 1.05) / step) * step,
    x = (t) => left + (w - left - right) * (tMax === firstT ? 0.5 : (t - firstT) / (tMax - firstT)),
    y = (n) => floor - ((floor - top) * n) / max;
  const svg = svgEl("svg", {
    viewBox: "0 0 " + w + " " + h,
    class: "chart",
    role: "group",
    "aria-label":
      "Committed technical debt in TDC over time, with its projection at the current pace. Baseline changes interrupt the line.",
  });
  for (let v = 0; v <= max + step / 2; v += step) {
    svg.append(svgEl("line", { x1: left, y1: y(v), x2: w - right, y2: y(v), class: v ? "grid" : "grid axis" }));
    svg.append(svgEl("text", { x: left - 9, y: y(v) + 4, "text-anchor": "end" }, compact(v)));
  }
  svg.append(svgEl("text", { x: left, y: 12 }, "TDC"));
  let points = [];
  function segment() {
    if (points.length) {
      const first = points[0],
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
      svg.append(svgEl("line", { x1: x(times[i]), y1: top, x2: x(times[i]), y2: floor, class: "baseline" }));
    }
    points.push([x(times[i]), y(e.debt)]);
  });
  segment();
  if (project) {
    /* Flat until today, then the pace of the forecast, down to zero or up to the horizon */
    const end = payoffT <= endT ? [x(payoffT), y(0)] : [x(endT), y(projected(endT))];
    const path = [[x(lastT), y(last.debt)], [x(start), y(last.debt)], end];
    svg.append(svgEl("polyline", { points: path.map((p) => p.join(",")).join(" "), class: "projection" }));
    if (start < tMax) {
      svg.append(svgEl("line", { x1: x(start), y1: top, x2: x(start), y2: floor, class: "today" }));
      if (x(start) - left > 50) svg.append(svgEl("text", { x: x(start), y: top - 8, "text-anchor": "middle" }, "Today"));
    }
    if (payoffT <= endT) {
      svg.append(svgEl("circle", { cx: end[0], cy: end[1], r: 4, class: "payoff" }));
      if (!data.goal)
        svg.append(
          svgEl("text", { x: end[0], y: end[1] - 10, "text-anchor": "end", class: "payofflabel" }, "Debt-free · " + date(payoffT))
        );
    }
  }
  if (data.goal) {
    const gy = y(data.goal.debt),
      dated = goalT >= firstT && goalT <= tMax && tMax > firstT,
      gx = dated ? x(goalT) : w - right,
      label = "Goal · " + fmt(data.goal.debt) + " by " + date(data.goal.date);
    svg.append(svgEl("line", { x1: left, y1: gy, x2: w - right, y2: gy, class: "goal" }));
    /* The goal is a point in time: the projection passes under it when the pace is enough */
    if (dated) svg.append(svgEl("circle", { cx: gx, cy: gy, r: 5.5, class: "goalpoint" }));
    svg.append(
      svgEl(
        "text",
        { x: gx, y: gy - 10, "text-anchor": gx > (left + w - right) / 2 ? "end" : "start", class: "goallabel" },
        label
      )
    );
  }
  /* every commit as a dot while they stay readable, the latest one always */
  events.forEach((e, i) => {
    if (events.length <= 40 || i === lastIndex)
      svg.append(svgEl("circle", { cx: x(times[i]), cy: y(e.debt), r: i === lastIndex ? 4.5 : 3, class: "dot" }));
  });
  const ticks = tMax === firstT ? [firstT] : w < 440 ? [firstT, tMax] : [firstT, (firstT + tMax) / 2, tMax];
  ticks.forEach((t) =>
    svg.append(
      svgEl(
        "text",
        {
          x: x(t),
          y: h - 10,
          "text-anchor": ticks.length === 1 ? "middle" : t === firstT ? "start" : t === tMax ? "end" : "middle",
        },
        date(t)
      )
    )
  );

  /* Reading a commit: the pointer or the arrow keys move the cursor, a click or Enter opens the commit */
  const cursor = svgEl("line", { y1: top, y2: floor, class: "cursor", visibility: "hidden" }),
    marker = svgEl("circle", { r: 5.5, class: "marker", visibility: "hidden" }),
    hit = svgEl("rect", {
      x: left,
      y: top,
      width: w - left - right,
      height: floor - top,
      class: "hit",
      tabindex: 0,
      role: "slider",
      "aria-label": "Commit of the trajectory. Arrow keys move, Enter opens the commit.",
      "aria-valuemin": 0,
      "aria-valuemax": lastIndex,
    }),
    tip = el("div", undefined, "tip");
  tip.hidden = true;
  let current = -1;
  function point(i) {
    current = Math.max(0, Math.min(lastIndex, i));
    const e = events[current],
      scale = svg.getBoundingClientRect().width / w || 1;
    const at = x(times[current]);
    cursor.setAttribute("x1", at);
    cursor.setAttribute("x2", at);
    marker.setAttribute("cx", at);
    marker.setAttribute("cy", y(e.debt));
    cursor.setAttribute("visibility", "visible");
    marker.setAttribute("visibility", "visible");
    const change = el("div", e.kind === "scored" ? undefined : balanceEventLabel(e.kind), "muted");
    if (e.kind === "scored") {
      change.append(
        el("span", e.paid ? "−" + fmt(e.paid) : "0", e.paid ? "paid" : ""),
        " repaid · ",
        el("span", e.created ? "+" + fmt(e.created) : "0", e.created ? "created" : ""),
        " new"
      );
    }
    const title = fmt(e.debt) + " TDC";
    tip.replaceChildren(
      el("small", date(e.date) + " · " + e.sha.slice(0, 7)),
      el("strong", title, "number"),
      el("div", e.subject, "subject"),
      change
    );
    tip.hidden = false;
    hit.setAttribute("aria-valuenow", current);
    hit.setAttribute("aria-valuetext", date(e.date) + ", " + title + ", " + e.subject);
    const half = tip.offsetWidth / 2,
      cx = Math.max(half, Math.min(host.clientWidth - half, at * scale)),
      above = y(e.debt) * scale - tip.offsetHeight - 14;
    tip.style.left = cx + "px";
    tip.style.top = (above < 0 ? y(e.debt) * scale + 14 : above) + "px";
  }
  function leave() {
    current = -1;
    tip.hidden = true;
    cursor.setAttribute("visibility", "hidden");
    marker.setAttribute("visibility", "hidden");
  }
  hit.addEventListener("pointermove", (ev) => {
    const box = svg.getBoundingClientRect(),
      px = ((ev.clientX - box.left) / (box.width || 1)) * w;
    /* the nearest commit in time; past the last one, the projection reads as the last commit */
    let near = 0;
    times.forEach((t, i) => {
      if (Math.abs(x(t) - px) <= Math.abs(x(times[near]) - px)) near = i;
    });
    point(near);
  });
  hit.addEventListener("pointerleave", () => {
    if (document.activeElement !== hit) leave();
  });
  hit.addEventListener("blur", leave);
  hit.addEventListener("focus", () => {
    if (current < 0) point(lastIndex);
  });
  hit.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft") point(current - 1);
    else if (ev.key === "ArrowRight") point(current + 1);
    else if (ev.key === "Home") point(0);
    else if (ev.key === "End") point(lastIndex);
    else if (ev.key === "Enter" && current >= 0) showCommit(events[current]);
    else return;
    ev.preventDefault();
  });
  hit.addEventListener("click", () => {
    if (current >= 0) showCommit(events[current]);
  });
  svg.append(cursor, marker, hit);
  host.append(svg, tip);
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

/* Open the debts of a file or a folder: the search matches the paths */
function showDebtsOf(path) {
  loadFindings();
  $("search").value = path;
  clearFacets();
  setView("all");
  page = 0;
  tab("debts");
}

/* Debt by folder: the folders ranked by debt, the smallest ones summed up */
(function folders() {
  const host = $("folders"),
    shown = data.folders.slice(0, 6),
    rest = data.folders.slice(6);
  if (!shown.length) {
    host.replaceWith(el("p", "No measured debt.", "empty"));
    return;
  }
  const rows = shown.map(([name, g]) => [name, g, () => showDebtsOf("/" + name + "/")]);
  if (rest.length)
    rows.push([
      plural(rest.length, "other folder"),
      rest.reduce((s, [, g]) => ({ cost: s.cost + g.cost, count: s.count + g.count }), { cost: 0, count: 0 }),
      undefined,
    ]);
  for (const [name, g, open] of rows) {
    const share = g.cost / Math.max(data.debt, 1),
      b = el("button", undefined, "category");
    b.type = "button";
    const head = el("div", undefined, "row");
    head.append(el("span", name, "name"), el("span", fmt(g.cost) + " TDC · " + Math.round(share * 100) + "%", "number"));
    const track = el("div", undefined, "track"),
      fill = el("div", undefined, "fill");
    fill.style.width = share * 100 + "%";
    track.append(fill);
    b.append(head, track, el("small", plural(g.count, "finding"), "muted"));
    if (open) {
      b.setAttribute("aria-label", name + ": " + fmt(g.cost) + " TDC in " + g.count + " findings. Show these debts.");
      b.onclick = open;
    } else b.disabled = true;
    host.append(b);
  }
})();

/* Collection notices: the files that owe the most */
const debtors = data.files;
if (!debtors.length) $("files").append(el("p", "No file owes anything. Keep the books clean.", "empty"));
debtors.forEach(([file, o], i) => {
  const b = el("button", undefined, "debtor");
  b.type = "button";
  const row = el("div", undefined, "row");
  const who = el("div", undefined, "who");
  who.append(el("small", "Notice #" + (i + 1) + " · " + plural(o.count, "finding")));
  who.append(pathNode(file));
  row.append(who, el("span", "owes " + fmt(o.cost) + " TDC", "owed number"));
  const hp = el("div", undefined, "hp"),
    track = el("div", undefined, "track"),
    fill = el("div", undefined, "fill");
  fill.style.width = (o.cost / Math.max(debtors[0][1].cost, 1)) * 100 + "%";
  track.append(fill);
  hp.append(el("span", "HP"), track);
  b.append(row, hp);
  b.onclick = () => showDebtsOf(file);
  $("files").append(b);
});

/* What the debt is made of: measured debt by category, each bar opening the debts of its category */
(function categories() {
  const rows = data.categories;
  $("cataloghint").hidden = data.catalog || !data.measuredCount;
  if (!data.catalog) text("categorytag", "By engine");
  if (!rows.length) $("categories").append(el("p", "No measured debt.", "empty"));
  rows.forEach(([name, g]) => {
    const b = el("button", undefined, "category");
    b.type = "button";
    const head = el("div", undefined, "row"),
      share = g.cost / Math.max(data.debt, 1);
    head.append(
      el("span", name, "name"),
      el("span", fmt(g.cost) + " TDC · " + Math.round(share * 100) + "%", "number")
    );
    const track = el("div", undefined, "track"),
      fill = el("div", undefined, "fill");
    /* the bar and the percentage share one reference: the measured debt */
    fill.style.width = share * 100 + "%";
    track.append(fill);
    b.append(head, track, el("small", plural(g.count, "finding"), "muted"));
    b.setAttribute("aria-label", name + ": " + fmt(g.cost) + " TDC in " + g.count + " findings. Show these debts.");
    b.onclick = () => {
      showDebtsOf("");
      chosen.category.add(name);
      renderRows();
    };
    $("categories").append(b);
  });
})();

/* Bounties: the most expensive debts, one per file, and the cheapest ones, one per rule */
function bountyCard(f) {
  const b = el("button", undefined, "bounty");
  b.type = "button";
  const reward = el("div", undefined, "reward");
  reward.append(withCoin(el("strong", "+" + fmt(f.cost), "number")), el("small", "bounty"));
  const what = el("div", undefined, "what");
  what.append(el("p", f.problem));
  if (f.problem !== f.rule) what.append(el("small", f.rule, "mono"));
  what.append(pathNode(f.file, f.line));
  b.append(what, reward);
  b.onclick = () => showDebt(f);
  return b;
}
const big = data.big.map(measuredFinding);
const quick = data.quick.map(measuredFinding);
if (!big.length) $("next").append(el("p", "No bounty left. Every measured debt is repaid.", "empty"));
big.forEach((f) => $("next").append(bountyCard(f)));
if (!quick.length)
  $("quick").append(el("p", big.length ? "Every rule is already in the big bounties." : "Nothing left to fix.", "empty"));
quick.forEach((f) => $("quick").append(bountyCard(f)));

/* A command to copy, with a fallback when the browser refuses the clipboard to a local file */
function copyButton(value, label) {
  const copy = el("button", "Copy");
  copy.type = "button";
  copy.setAttribute("aria-label", label);
  copy.onclick = async (ev) => {
    ev.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select the text to copy it";
    }
  };
  return copy;
}
function commandRow(command, label) {
  const row = el("div", undefined, "command");
  row.append(el("pre", command), copyButton(command, label));
  return row;
}

/* Your next move: the cheapest fix, the biggest bounty, and the file where the debt grows */
(function moves() {
  const items = [],
    cheapest = quick.concat(big).sort((a, b) => a.cost - b.cost)[0];
  if (cheapest) items.push({ label: "Quick win · about " + fmt(cheapest.cost) + " min", tone: "paid", finding: cheapest });
  if (big[0] && big[0] !== cheapest) items.push({ label: "Biggest bounty", tone: "gold", finding: big[0] });
  const grown = new Map();
  for (const e of scoredSince(30))
    for (const f of e.createdFindings) grown.set(f.file, (grown.get(f.file) || 0) + f.cost);
  const hot = [...grown].sort((a, b) => b[1] - a[1])[0];
  if (hot)
    items.push({ label: "Hotspot · growing", tone: "created", file: hot[0], title: "Review a file before it grows further", reward: "+" + fmt(hot[1]) + " TDC in 30 days" });
  else if (debtors[0])
    items.push({ label: "Most indebted file", tone: "created", file: debtors[0][0], title: plural(debtors[0][1].count, "finding") + " in one file", reward: fmt(debtors[0][1].cost) + " TDC" });
  if (!items.length) {
    $("moves").closest("section").hidden = true;
    return;
  }
  for (const item of items) {
    const card = el("article", undefined, "move"),
      head = el("div", undefined, "movehead"),
      f = item.finding;
    head.append(el("span", item.label, "pill " + item.tone));
    if (f) {
      head.append(withCoin(el("strong", "+" + fmt(f.cost), "number gold")));
      const open = el("button", f.problem, "movetitle");
      open.type = "button";
      open.onclick = () => showDebt(f);
      card.append(head, open);
      if (f.problem !== f.rule) card.append(el("small", f.rule, "mono muted"));
      card.append(pathNode(f.file, f.line), commandRow("sf tdc check --id " + f.id, "Copy the verification command"));
    } else {
      head.append(el("strong", item.reward, "number " + item.tone));
      const open = el("button", "Open its debts", "linkbutton");
      open.type = "button";
      open.onclick = () => showDebtsOf(item.file);
      card.append(head, el("p", item.title, "movetitle"), pathNode(item.file), open);
    }
    $("moves").append(card);
  }
})();

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
  /* without a goal, one line: the objective sits right under the balance */
  $("objective").classList.add("compact");
  text("goaltitle", "No objective yet.");
  text("goaltext", "Give the debt a finish line: set goal.debt and goal.date with sf tdc init.");
  $("goaltrack").hidden = true;
  $("forecast").hidden = true;
}

/* Debts: facets with their counts, debts grouped by file */
let all;
/* The folder that names the kind of metadata, as in the debt by folder */
function folderOf(file) {
  const parts = file.split("/"),
    root = parts.lastIndexOf("default");
  if (root >= 0 && root < parts.length - 2) return parts[root + 1];
  return parts.length > 1 ? parts[parts.length - 2] : ".";
}
const FACETS = [
  ["category", "Category", (f) => groupOf(f)],
  ["severity", "Severity", (f) => f.severity || "No severity"],
  ["folder", "Folder", (f) => folderOf(f.file)],
  ["source", "Source", (f) => (measured(f) ? "Measured · analyzer" : "Declared · " + f.source)],
];
const chosen = {},
  expanded = new Set();
FACETS.forEach(([key]) => (chosen[key] = new Set()));
function clearFacets() {
  FACETS.forEach(([key]) => chosen[key].clear());
}
function loadFindings() {
  if (all) return;
  const block = $("tdc-details");
  const { rows, paths, snippets, declared } = JSON.parse(block.textContent);
  block.remove();
  all = rows
    .map(([id, rule, file, snippet, cost, line]) =>
      measuredFinding({ id, rule, file: paths[file], snippet: snippets[snippet], cost, line })
    )
    .concat(declared);
  for (const f of all) {
    f.values = FACETS.map(([, , valueOf]) => valueOf(f));
    f.haystack = [f.file, f.rule, f.problem, f.id, f.category || ""].join(" ").toLowerCase();
  }
}
text("measuredtotal", fmt(data.debt) + " TDC");
text("declaredtotal", fmt(data.declaredDebt) + " declared TDC · outside balance");

/* The detail of a debt, in a dialog */
function fillDebt(body, f) {
  const tags = el("div", undefined, "tags");
  tags.append(
    el("span", measured(f) ? "Measured debt" : "Declared · " + f.source, "tag"),
    el("span", f.rule, "tag mono")
  );
  if (f.category) tags.append(el("span", f.category, "tag"));
  if (f.severity) tags.append(severityNode(f.severity));
  const figures = el("div", undefined, "figures");
  for (const [value, label] of [
    [fmt(f.cost), "TDC"],
    ["~" + fmt(f.cost) + " min", "to fix"],
  ]) {
    const box = el("div");
    box.append(el("strong", value, "number"), el("small", label, "muted"));
    figures.append(box);
  }
  const place = el("p");
  place.append(pathNode(f.file, f.line));
  body.append(tags, figures, place, el("pre", f.snippet || "No source snippet available."));
  if (measured(f) && !f.line)
    body.append(el("p", "Line not found in the current source: the file changed since the scan.", "muted"));
  /* only web links: the url comes from the catalog, a file of the repository */
  if (f.url && /^https?:/i.test(f.url)) {
    const link = el("a", "Rule documentation");
    link.href = f.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const p = el("p");
    p.append(link);
    body.append(p);
  }
  body.append(
    measured(f)
      ? withCoin(el("p", "Bounty: +" + fmt(f.cost) + " coins for the commit that repays it.", "gold"))
      : el("p", "No bounty: declared debt is outside the ledger and coin calculations.", "muted")
  );
  const command = "sf tdc check --id " + f.id;
  body.append(el("h3", "Check that it is repaid"), commandRow(command, "Copy the verification command"));
  /* A prompt for a coding agent: what to fix, where, and how to prove it is repaid */
  const prompt =
    "Fix this technical debt: " + f.problem + " (rule " + f.rule + ") in " + f.file +
    (f.line ? " at line " + f.line : "") +
    ". Keep the behaviour unchanged. Then run sf tdc scan and " + command + " to verify that it is repaid.";
  body.append(el("h3", "Hand it to a coding agent"), commandRow(prompt, "Copy the prompt for a coding agent"));
  body.append(el("p", "Finding ID: " + f.id, "muted mono"));
}
function showDebt(f) {
  text("detailtitle", f.problem);
  const body = $("detailbody");
  body.replaceChildren();
  fillDebt(body, f);
  $("detail").showModal();
}
$("close").onclick = () => $("detail").close();
/* a click on the backdrop lands on the dialog itself: its content lives in the sheet */
$("detail").addEventListener("click", (ev) => {
  if (ev.target === $("detail")) $("detail").close();
});

/* Saved views: a cost range on top of the filters */
let view = "all";
const VIEWS = { all: () => true, quick: (f) => f.cost <= 15, big: (f) => f.cost >= 60 };
function setView(name) {
  view = name;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
}
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      setView(b.dataset.view);
      page = 0;
      renderRows();
    })
);

/* One pass: the matching debts, and for each facet the counts under every other filter */
const sortedFindings = new Map();
let filterKey, matching, measuredCost, declaredCost, facetCounts, searchTimer;
function filterFindings() {
  const q = $("search").value.toLowerCase(),
    sort = $("sort").value;
  const key = JSON.stringify([q, sort, view, FACETS.map(([k]) => [...chosen[k]])]);
  if (key === filterKey) return;
  filterKey = key;
  $("reset").hidden = !q && view === "all" && FACETS.every(([k]) => !chosen[k].size);
  if (!sortedFindings.has(sort)) {
    const byFile = (a, b) => a.file.localeCompare(b.file);
    const byCost = (a, b) => b.cost - a.cost;
    sortedFindings.set(
      sort,
      [...all].sort(sort === "file" ? (a, b) => byFile(a, b) || byCost(a, b) : (a, b) => byCost(a, b) || byFile(a, b))
    );
  }
  const sets = FACETS.map(([k]) => chosen[k]);
  facetCounts = FACETS.map(() => new Map());
  matching = [];
  measuredCost = 0;
  declaredCost = 0;
  for (const f of sortedFindings.get(sort)) {
    if (!VIEWS[view](f) || (q && !f.haystack.includes(q))) continue;
    let failed = -1,
      failures = 0;
    for (let i = 0; i < sets.length; i++)
      if (sets[i].size && !sets[i].has(f.values[i])) {
        failed = i;
        failures++;
      }
    if (failures > 1) continue;
    for (let i = 0; i < sets.length; i++) {
      if (failures && i !== failed) continue;
      const counts = facetCounts[i];
      counts.set(f.values[i], (counts.get(f.values[i]) || 0) + 1);
    }
    if (failures) continue;
    matching.push(f);
    if (measured(f)) measuredCost += f.cost;
    else declaredCost += f.cost;
  }
}
function renderFacets() {
  const host = $("facets");
  host.replaceChildren();
  FACETS.forEach(([key, label], i) => {
    const counts = facetCounts[i];
    for (const value of chosen[key]) if (!counts.has(value)) counts.set(value, 0);
    const values = [...counts];
    if (key === "severity") {
      const order = (v) => (SEVERITIES.includes(v) ? SEVERITIES.indexOf(v) : 99);
      values.sort((a, b) => order(a[0]) - order(b[0]));
    } else values.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const box = el("fieldset", undefined, "facet");
    box.append(el("legend", label, "eyebrow"));
    const open = expanded.has(key),
      shown = open ? values : values.slice(0, 7);
    for (const [value, count] of shown) {
      const row = el("label", undefined, "facetrow"),
        input = el("input");
      input.type = "checkbox";
      input.checked = chosen[key].has(value);
      input.onchange = () => {
        if (input.checked) chosen[key].add(value);
        else chosen[key].delete(value);
        page = 0;
        renderRows();
      };
      row.append(input, el("span", value, "value"), el("span", fmt(count), "number muted"));
      box.append(row);
    }
    if (values.length > 7) {
      const more = el("button", open ? "Show less" : "Show " + (values.length - 7) + " more", "link");
      more.type = "button";
      more.onclick = () => {
        if (open) expanded.delete(key);
        else expanded.add(key);
        renderFacets();
      };
      box.append(more);
    }
    if (!values.length) box.append(el("p", "None", "muted"));
    host.append(box);
  });
}
function debtRow(f) {
  const row = el("button", undefined, "debtrow");
  row.type = "button";
  const what = el("span", undefined, "what");
  what.append(el("span", f.problem, "problem"), el("small", f.rule + (f.line ? " · line " + f.line : ""), "mono muted"));
  if ($("group").value === "none") what.append(pathNode(f.file, f.line));
  row.append(
    what,
    el("span", groupOf(f), "pill"),
    f.severity ? severityNode(f.severity) : el("span", "—", "muted"),
    el("span", fmt(f.cost), "number gold cost")
  );
  row.onclick = () => showDebt(f);
  return row;
}
function renderRows() {
  clearTimeout(searchTimer);
  loadFindings();
  filterFindings();
  renderFacets();
  const host = $("rows"),
    grouped = $("group").value === "file",
    totals = fmt(measuredCost) + " measured TDC · " + fmt(declaredCost) + " declared TDC";
  host.replaceChildren();
  let pages;
  if (grouped) {
    const groups = new Map();
    for (const f of matching) {
      const g = groups.get(f.file) || { file: f.file, cost: 0, rows: [] };
      g.cost += f.cost;
      g.rows.push(f);
      groups.set(f.file, g);
    }
    const list = [...groups.values()];
    if ($("sort").value === "cost") list.sort((a, b) => b.cost - a.cost || a.file.localeCompare(b.file));
    pages = Math.max(1, Math.ceil(list.length / 15));
    page = Math.min(page, pages - 1);
    list.slice(page * 15, (page + 1) * 15).forEach((g) => {
      const head = el("button", undefined, "filehead");
      head.type = "button";
      head.title = "Show only the debts of this file";
      head.append(pathNode(g.file), el("span", plural(g.rows.length, "debt") + " · " + fmt(g.cost) + " TDC", "number gold"));
      head.onclick = () => {
        $("search").value = g.file;
        $("group").value = "none";
        page = 0;
        renderRows();
      };
      host.append(head);
      g.rows.slice(0, 4).forEach((f) => host.append(debtRow(f)));
      if (g.rows.length > 4) {
        const more = el("button", "+ " + plural(g.rows.length - 4, "more debt") + " in this file", "link morerows");
        more.type = "button";
        more.onclick = head.onclick;
        host.append(more);
      }
    });
    text("results", plural(matching.length, "finding") + " in " + plural(list.length, "file") + " · " + totals);
  } else {
    pages = Math.max(1, Math.ceil(matching.length / 50));
    page = Math.min(page, pages - 1);
    matching.slice(page * 50, (page + 1) * 50).forEach((f) => host.append(debtRow(f)));
    text("results", plural(matching.length, "finding") + " · " + totals);
  }
  if (!matching.length) host.append(el("p", all.length ? "No debts match these filters." : "No debt on the books.", "empty"));
  text("page", page + 1 + " / " + pages);
  $("previous").disabled = page === 0;
  $("nextpage").disabled = page === pages - 1;
}
$("reset").onclick = () => {
  $("search").value = "";
  clearFacets();
  setView("all");
  page = 0;
  renderRows();
};
$("search").addEventListener("input", () => {
  page = 0;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderRows, 150);
});
for (const id of ["group", "sort"])
  $(id).addEventListener("change", () => {
    page = 0;
    renderRows();
  });
$("previous").onclick = () => {
  page--;
  renderRows();
  $("debts").scrollIntoView();
};
$("nextpage").onclick = () => {
  page++;
  renderRows();
  $("debts").scrollIntoView();
};

/* Collectors: the leaderboard of a period, computed from the scored commits */
let season = 0;
const team = data.history.length > 0 && data.history.every((e) => !e.author);
function playersOf(days) {
  if (!days) return data.players;
  const byAuthor = new Map();
  for (const e of scoredSince(days)) {
    const name = e.author || "The team",
      p = byAuthor.get(name) || { author: name, coins: 0, paid: 0, created: 0, deleted: 0, commits: 0 };
    p.coins += e.coins;
    p.paid += e.paid;
    p.created += e.created;
    p.deleted += e.deleted;
    if (e.paid || e.created || e.deleted) p.commits++;
    byAuthor.set(name, p);
  }
  return [...byAuthor.values()].sort((a, b) => b.coins - a.coins || a.author.localeCompare(b.author));
}
const eventsOf = (p, days) => scoredSince(days).filter((e) => team || e.author === p.author);
/* The coins of the last 12 weeks, one point a week */
function sparkline(p) {
  const weeks = new Array(12).fill(0),
    end = Date.parse(data.generatedAt);
  for (const e of eventsOf(p, 84)) {
    const week = 11 - Math.floor((end - Date.parse(e.date)) / (7 * 86400000));
    if (week >= 0 && week < 12) weeks[week] += e.coins;
  }
  const low = Math.min(0, ...weeks),
    high = Math.max(1, ...weeks),
    svg = svgEl("svg", { viewBox: "0 0 110 28", class: "spark", role: "img" });
  svg.setAttribute(
    "aria-label",
    "Coins per week over 12 weeks: " + weeks.map((n) => fmt(n)).join(", ")
  );
  const at = (n) => 25 - ((n - low) / (high - low)) * 22;
  if (low < 0) svg.append(svgEl("line", { x1: 0, x2: 110, y1: at(0), y2: at(0), class: "zero" }));
  svg.append(svgEl("polyline", { points: weeks.map((n, i) => i * 10 + "," + at(n)).join(" ") }));
  return svg;
}
function repaying(p, days) {
  const scored = eventsOf(p, days).filter((e) => e.paid || e.created);
  return scored.length ? Math.round((scored.filter((e) => e.paid > e.created).length / scored.length) * 100) : 0;
}
function collectors() {
  const players = playersOf(season);
  $("podium").replaceChildren();
  $("playerrows").replaceChildren();
  $("players").hidden = !players.length;
  if (!players.length)
    $("podium").append(
      el(
        "p",
        season
          ? "No scored commit in this period."
          : "No collector yet. Commit a change that repays debt to enter the leaderboard.",
        "empty"
      )
    );
  const medals = ["🥇", "🥈", "🥉"];
  players.slice(0, 3).forEach((p, i) => {
    const step = el("div", undefined, "step p" + (i + 1));
    step.style.order = String([2, 1, 3][i]);
    step.append(
      el("div", medals[i], "medal"),
      el("h3", p.author),
      el("small", plural(p.commits, "commit")),
      withCoin(el("div", signed(p.coins), "coins number"))
    );
    $("podium").append(step);
  });
  players.forEach((p, i) => {
    const row = el("tr");
    row.append(el("td", String(i + 1), "number"));
    const who = el("td");
    who.append(
      el("strong", p.author),
      el("br"),
      el("small", plural(p.commits, "commit") + " · " + repaying(p, season) + "% repaying")
    );
    const trend = el("td");
    trend.append(sparkline(p));
    row.append(
      who,
      trend,
      el("td", "−" + fmt(p.paid), "num paid"),
      el("td", "+" + fmt(p.created), "num created"),
      el("td", signed(p.coins), "num number " + (p.coins < 0 ? "created" : "gold"))
    );
    $("playerrows").append(row);
  });
}
document.querySelectorAll("[data-season]").forEach(
  (b) =>
    (b.onclick = () => {
      season = Number(b.dataset.season);
      document.querySelectorAll("[data-season]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      collectors();
    })
);
collectors();

/* The overview's glance at the statement and the leaderboard */
(function glance() {
  if (!data.history.length) return;
  [...data.history]
    .reverse()
    .slice(0, 5)
    .forEach((e) => {
      const scored = e.kind === "scored",
        line = el("button", undefined, "recent");
      line.type = "button";
      const what = el("span", undefined, "what");
      what.append(
        el("span", e.subject, "subject"),
        el("small", date(e.date) + (e.author ? " · " + e.author : "") + " · " + e.sha.slice(0, 7), "muted")
      );
      const move = el("span", undefined, "number");
      if (!scored) move.append(el("span", "No coins", "muted"));
      else {
        if (e.paid) move.append(el("span", "−" + fmt(e.paid), "paid"));
        if (e.created) move.append((e.paid ? " " : ""), el("span", "+" + fmt(e.created), "created"));
        if (!e.paid && !e.created) move.append(el("span", "0", "muted"));
      }
      line.append(what, move, el("span", fmt(e.debt), "number balancecol"));
      line.onclick = () => showCommit(e);
      $("recentlines").append(line);
    });
  const top = playersOf(30).slice(0, 3);
  if (!top.length) $("topcollectors").replaceWith(el("p", "No scored commit in the last 30 days.", "empty"));
  top.forEach((p, i) => {
    const item = el("li"),
      who = el("span", undefined, "who");
    who.append(el("strong", p.author), el("small", plural(p.commits, "commit"), "muted"));
    item.append(el("span", String(i + 1), "place p" + (i + 1)), who, withCoin(el("strong", signed(p.coins), "number gold")));
    $("topcollectors").append(item);
  });
})();
document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => tab(b.dataset.go)));

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
    body.append(el("p", balanceEventLabel(e.kind), "notice"));
  else body.append(withCoin(el("p", "Coins: " + signed(e.coins), e.coins < 0 ? "created" : "gold")));
  for (const [label, list] of [
    ["Repaid", e.paidFindings],
    ["New debt", e.createdFindings],
  ]) {
    body.append(el("h3", label + " · " + list.length));
    list.slice(0, 100).forEach((f) => {
      const line = el("div", undefined, "change"),
        what = el("div");
      what.append(el("div", f.rule, "mono"), pathNode(f.file));
      line.append(what, el("span", fmt(f.cost) + " TDC", "number"));
      body.append(line);
    });
    if (list.length > 100) body.append(el("p", "Showing the first 100 findings."));
  }
  body.append(
    el("p", fmt(e.deleted) + " TDC written off with deleted files · " + e.moved + " findings moved.", "muted")
  );
  $("detail").showModal();
}
function balanceEventLabel(kind) {
  if (kind === "baseline") return "Ledger baseline · no coins";
  if (kind === "merge") return "Merged ledger · no coins";
  return "Portfolio revaluation · rules or engines changed · no coins";
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
      clickable(row, () => showCommit(e));
      info.append(b, el("br"), el("small", (e.author ? e.author + " · " : "") + e.sha.slice(0, 7)));
      if (!scored) info.append(el("p", balanceEventLabel(e.kind), "gold"));
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

if (TABS.includes(fromHash())) tab(fromHash());

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
