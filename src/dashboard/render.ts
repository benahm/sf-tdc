import type { DashboardData } from './data.js';

/** Escape the script-data boundary, including strings supplied by source code and commit messages. */
export const renderDashboard = (data: DashboardData): string => {
  const json = JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    />
    <title>TDC · Debt dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #111310;
        --panel: #191c18;
        --ink: #eceee5;
        --muted: #a3aa9b;
        --line: #343a30;
        --gold: #edc46e;
        --soft: #29271d;
        --green: #98cca9;
        --red: #f29d8e;
        --blue: #a4bddb;
        --shadow: 0 20px 80px #0005;
      }
      :root[data-theme="light"] {
        color-scheme: light;
        --bg: #f7f5ee;
        --panel: #fffef9;
        --ink: #242b23;
        --muted: #626b5c;
        --line: #dddccf;
        --gold: #89621c;
        --soft: #eee7d5;
        --green: #286745;
        --red: #a63e32;
        --blue: #365a88;
        --shadow: 0 20px 80px #252b231a;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      button,
      input,
      select {
        font: inherit;
      }
      button {
        cursor: pointer;
      }
      button,
      input,
      select {
        color: inherit;
      }
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible {
        outline: 2px solid var(--gold);
        outline-offset: 4px;
      }
      button {
        background: none;
        border: 1px solid var(--line);
        border-radius: 7px;
        padding: 7px 12px;
      }
      button:hover {
        background: var(--soft);
      }
      button[aria-pressed="true"],
      .active {
        background: var(--soft);
        color: var(--gold);
      }
      button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      input,
      select {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 7px;
        padding: 9px 12px;
        min-width: 0;
      }
      h1,
      h2,
      h3,
      p {
        margin: 0;
      }
      h1 {
        font-size: 30px;
        letter-spacing: -1px;
        font-weight: 600;
      }
      h2 {
        font-size: 18px;
        font-weight: 600;
      }
      h3 {
        font-size: 15px;
      }
      small,
      .muted {
        color: var(--muted);
      }
      .mono,
      code,
      .number {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }
      .number {
        font-variant-numeric: tabular-nums;
      }
      .gold {
        color: var(--gold);
      }
      .paid {
        color: var(--green);
      }
      .created {
        color: var(--red);
      }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 600;
      }
      .app {
        max-width: 1280px;
        margin: auto;
        padding: 0 40px 40px;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
        padding: 24px 0;
        border-bottom: 1px solid var(--line);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 1px;
      }
      .coin {
        display: grid;
        place-items: center;
        border: 1px solid var(--gold);
        border-radius: 50%;
        width: 30px;
        height: 30px;
        color: var(--gold);
        font-size: 18px;
      }
      .project {
        border-left: 1px solid var(--line);
        padding-left: 18px;
        overflow-wrap: anywhere;
      }
      .right {
        margin-left: auto;
      }
      .tag {
        font-size: 12px;
        padding: 3px 8px;
        border: 1px solid var(--line);
        border-radius: 5px;
        overflow-wrap: anywhere;
      }
      .intro {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: end;
        margin: 34px 0 22px;
        flex-wrap: wrap;
      }
      .intro p {
        margin-top: 5px;
      }
      .nav {
        display: flex;
        gap: 24px;
        border-bottom: 1px solid var(--line);
        margin-bottom: 26px;
      }
      .nav button {
        border: 0;
        border-radius: 0;
        padding: 12px 0;
        color: var(--muted);
      }
      .nav button[aria-pressed="true"] {
        color: var(--gold);
        border-bottom: 2px solid var(--gold);
        background: none;
      }
      .metrics {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 24px;
        margin-bottom: 26px;
      }
      .metric {
        padding: 8px 0 12px;
      }
      .metric + .metric {
        padding-left: 24px;
        border-left: 1px solid var(--line);
      }
      .amount {
        font-size: 40px;
        letter-spacing: -1.8px;
        margin: 7px 0 2px;
        line-height: 1.2;
      }
      .amount span {
        font-size: 14px;
        letter-spacing: 0;
        color: var(--muted);
      }
      .metric:not(:first-child) .amount {
        font-size: 30px;
        margin-top: 14px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 24px;
      }
      .panelhead {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: start;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .periods {
        display: flex;
        gap: 5px;
      }
      .periods button {
        font-size: 12px;
        padding: 5px 9px;
      }
      .chart {
        width: 100%;
        height: auto;
        display: block;
        overflow: visible;
      }
      .chart text {
        fill: var(--muted);
        font: 11px system-ui;
      }
      .chart .grid {
        stroke: var(--line);
        stroke-width: 1;
      }
      .chart .debt {
        stroke: var(--gold);
        fill: none;
        stroke-width: 2.5;
        stroke-linejoin: round;
      }
      .chart .goal {
        stroke: var(--blue);
        stroke-dasharray: 5 5;
      }
      .chart .baseline {
        stroke: var(--muted);
        stroke-dasharray: 3 5;
      }
      .legend {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        font-size: 12px;
        color: var(--muted);
        margin-top: 14px;
      }
      .legend span::before {
        content: "";
        display: inline-block;
        width: 14px;
        height: 2px;
        background: var(--gold);
        vertical-align: middle;
        margin-right: 7px;
      }
      .legend .reference::before {
        background: var(--muted);
      }
      .legend .target::before {
        background: var(--blue);
      }
      .split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 20px;
      }
      .bars {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .filebutton {
        display: block;
        width: 100%;
        padding: 0;
        border: none;
        text-align: left;
      }
      .barlabel {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 13px;
      }
      .filename {
        overflow-wrap: anywhere;
      }
      .track {
        height: 6px;
        background: var(--line);
        border-radius: 4px;
        overflow: hidden;
      }
      .fill {
        height: 100%;
        background: var(--gold);
        border-radius: 4px;
      }
      .filebutton:hover {
        background: none;
      }
      .filebutton:hover .filename {
        text-decoration: underline;
      }
      .nextitem {
        display: flex;
        width: 100%;
        gap: 14px;
        align-items: center;
        text-align: left;
        padding: 13px 0;
        border: 0;
        border-bottom: 1px solid var(--line);
        border-radius: 0;
      }
      .nextitem:last-child {
        border-bottom: 0;
      }
      .nextitem .cost {
        margin-left: auto;
        white-space: nowrap;
        color: var(--gold);
      }
      .nextitem p {
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .nextitem small {
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .goalbox {
        margin-top: 20px;
        display: flex;
        gap: 24px;
        align-items: center;
        flex-wrap: wrap;
      }
      .goalcopy {
        flex: 1;
        min-width: 180px;
      }
      .goalbox .track {
        margin: 12px 0;
      }
      .toolbar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin: 18px 0;
      }
      .toolbar input {
        flex: 2;
        min-width: 160px;
      }
      .toolbar select {
        flex: 1;
        min-width: 140px;
      }
      .notice {
        padding: 12px 16px;
        border-left: 2px solid var(--gold);
        background: var(--soft);
        font-size: 13px;
        margin: 16px 0;
      }
      .tablewrap {
        overflow-x: auto;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        text-align: left;
      }
      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--muted);
        font-weight: 500;
        padding: 12px;
      }
      td {
        padding: 14px 12px;
        border-top: 1px solid var(--line);
        vertical-align: top;
        font-size: 13px;
      }
      td button {
        border: 0;
        padding: 0;
        text-align: left;
        border-radius: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      td p,
      td small {
        overflow-wrap: anywhere;
      }
      td .number {
        white-space: nowrap;
      }
      .pager {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: end;
        margin-top: 16px;
        font-size: 13px;
      }
      .empty {
        padding: 35px 16px;
        text-align: center;
        color: var(--muted);
      }
      .activity {
        display: flex;
        flex-direction: column;
      }
      .event {
        display: grid;
        grid-template-columns: 90px 1fr auto;
        gap: 16px;
        padding: 20px 0;
        border-bottom: 1px solid var(--line);
      }
      .event:first-child {
        padding-top: 0;
      }
      .event p {
        overflow-wrap: anywhere;
      }
      .event button {
        margin-top: 8px;
        font-size: 12px;
      }
      .eventnums {
        display: flex;
        gap: 14px;
        font-size: 13px;
        white-space: nowrap;
      }
      .foot {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 28px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
        font-size: 12px;
        color: var(--muted);
      }
      dialog {
        background: var(--panel);
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: 12px;
        width: min(700px, calc(100% - 24px));
        max-height: 85vh;
        padding: 26px;
        box-shadow: var(--shadow);
      }
      dialog::backdrop {
        background: #0008;
      }
      dialog header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 20px;
      }
      dialog h2 {
        overflow-wrap: anywhere;
      }
      dialog pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: var(--bg);
        padding: 16px;
        border-radius: 7px;
        font-size: 13px;
      }
      dialog .tag {
        display: inline-block;
        margin: 0 6px 8px 0;
      }
      dialog p {
        margin: 12px 0;
        overflow-wrap: anywhere;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
      }
      [hidden] {
        display: none !important;
      }
      @media (prefers-reduced-motion: no-preference) {
        button {
          transition: background 0.15s, color 0.15s;
        }
      }
      @media (max-width: 800px) {
        .app {
          padding: 0 20px 28px;
        }
        .split {
          grid-template-columns: 1fr;
        }
        .amount {
          font-size: 32px;
        }
        .metrics {
          gap: 14px;
        }
        .metric + .metric {
          padding-left: 14px;
        }
        .event {
          grid-template-columns: 75px 1fr;
        }
        .eventnums {
          grid-column: 2;
        }
        .project {
          max-width: 60%;
        }
      }
      @media (max-width: 520px) {
        .metrics {
          grid-template-columns: 1fr 1fr;
        }
        .metric:first-child {
          grid-column: 1/-1;
        }
        .metric:nth-child(2) {
          border-left: 0;
          padding-left: 0;
        }
        .panel {
          padding: 17px;
        }
        .top {
          gap: 12px;
        }
        .right {
          margin-left: 0;
        }
        .intro {
          margin-top: 24px;
        }
        h1 {
          font-size: 26px;
        }
        .nav {
          gap: 20px;
        }
        .event {
          grid-template-columns: 1fr;
        }
        .eventnums {
          grid-column: 1;
        }
        .pager {
          justify-content: start;
          flex-wrap: wrap;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <header class="top">
        <div class="brand">
          <span class="coin" aria-hidden="true">T</span>TDC<span
            class="muted"
            style="font-weight: 400; font-size: 12px; letter-spacing: 0"
            >Debt Collector</span
          >
        </div>
        <span class="project" id="project"></span><span class="tag mono" id="branch"></span
        ><button class="right" id="theme" type="button">Switch theme</button>
      </header>
      <div class="intro">
        <div>
          <div class="eyebrow">Your technical debt, accounted for.</div>
          <h1>Collect progress.<br /><span class="gold">Pay down the debt.</span></h1>
          <p class="muted" id="snapshot"></p>
        </div>
        <span class="tag" id="generated"></span>
      </div>
      <nav class="nav" aria-label="Dashboard views">
        <button type="button" data-tab="overview" aria-controls="overview" aria-pressed="true">Overview</button
        ><button type="button" data-tab="debts" aria-controls="debts" aria-pressed="false">
          Debts <span id="debtcount"></span></button
        ><button type="button" data-tab="activity" aria-controls="activity" aria-pressed="false">Activity</button>
      </nav>
      <main>
        <section id="overview" aria-label="Overview">
          <div class="metrics">
            <div class="metric">
              <div class="eyebrow">Outstanding · measured debt</div>
              <div class="amount number gold" id="outstanding"></div>
              <small id="price"></small>
            </div>
            <div class="metric">
              <div class="eyebrow">Repaid · selected period</div>
              <div class="amount number paid" id="paid"></div>
              <small>Findings corrected in scored commits</small>
            </div>
            <div class="metric">
              <div class="eyebrow">New debt · selected period</div>
              <div class="amount number created" id="created"></div>
              <small>Findings introduced in scored commits</small>
            </div>
          </div>
          <div class="panel">
            <div class="panelhead">
              <div>
                <h2>The repayment trajectory</h2>
                <p class="muted" style="font-size: 13px">
                  Committed debt · inspect individual commits in Activity
                </p>
              </div>
              <div class="periods" aria-label="History period">
                <button type="button" data-days="30" aria-pressed="false">30 days</button
                ><button type="button" data-days="90" aria-pressed="false">90 days</button
                ><button type="button" data-days="0" aria-pressed="true">All time</button>
              </div>
            </div>
            <div id="chart"></div>
            <div class="legend">
              <span>Measured debt</span><span class="reference">New measurement baseline</span
              ><span class="target">Goal</span>
            </div>
            <p class="muted" style="font-size: 12px; margin-top: 10px">
              File deletions lower the balance but are separate from repayments. Gaps mark changes of rules,
              costs or engines.
            </p>
          </div>
          <div class="split">
            <section class="panel">
              <div class="panelhead">
                <div>
                  <div class="eyebrow">Where the debt lives</div>
                  <h2>Highest balances</h2>
                </div>
                <span class="tag">Boss files</span>
              </div>
              <div class="bars" id="files"></div>
            </section>
            <section class="panel">
              <div class="panelhead">
                <div>
                  <div class="eyebrow">Your next move</div>
                  <h2>Start collecting</h2>
                </div>
                <span class="tag">Highest cost first</span>
              </div>
              <div id="next"></div>
            </section>
          </div>
          <section class="panel goalbox">
            <div class="goalcopy">
              <div class="eyebrow">Repayment objective</div>
              <h2 id="goaltitle"></h2>
              <p class="muted" id="goaltext"></p>
            </div>
            <div class="goalcopy">
              <div id="goaltrack" class="track"><div id="goalprogress" class="fill"></div></div>
              <p class="muted" id="forecast"></p>
            </div>
          </section>
        </section>
        <section id="debts" aria-label="Debt explorer" hidden>
          <div class="panelhead">
            <div>
              <h2>The collection book</h2>
              <p class="muted">Inspect a finding, understand its cost, and take the next step.</p>
            </div>
            <span class="tag" id="declaredtotal"></span>
          </div>
          <p class="notice">
            Declared debt is tracked separately. It does not contribute to the measured balance or earn coins.
            Run sf tdc scan before generating the report to include your latest code changes.
          </p>
          <div class="toolbar">
            <label class="sr" for="search">Search debts</label
            ><input id="search" type="search" placeholder="Search file, rule, problem or ID…" /><label
              class="sr"
              for="source"
              >Source</label
            ><select id="source">
              <option value="all">All sources</option>
              <option value="code-analyzer">Measured · analyzer</option>
              <option value="agent">Declared · agent</option>
              <option value="human">Declared · human</option></select
            ><label class="sr" for="engine">Engine or category</label
            ><select id="engine">
              <option value="all">All engines / categories</option></select
            ><label class="sr" for="sort">Sort debts</label
            ><select id="sort">
              <option value="cost">Highest cost</option>
              <option value="file">File name</option>
            </select>
          </div>
          <p id="results" class="muted" aria-live="polite"></p>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Finding / file</th>
                  <th scope="col">Rule / source</th>
                  <th scope="col">TDC</th>
                </tr>
              </thead>
              <tbody id="rows"></tbody>
            </table>
          </div>
          <div class="pager">
            <button type="button" id="previous">Previous</button><span id="page" class="number"></span
            ><button type="button" id="nextpage">Next</button>
          </div>
        </section>
        <section id="activity" aria-label="Commit activity" hidden>
          <div class="panelhead">
            <div>
              <h2>The repayment journal</h2>
              <p class="muted">Scored commits, file deletions and measurement changes.</p>
            </div>
            <span class="tag">Most recent first</span>
          </div>
          <div id="events" class="activity"></div>
          <button type="button" id="moreevents" hidden>Show more commits</button>
        </section>
      </main>
      <footer class="foot">
        <span>1 TDC = 1 estimated minute of correction · Git is the source of committed history.</span
        ><span>Offline snapshot · no external services</span>
      </footer>
    </div>
    <dialog id="detail" aria-labelledby="detailtitle">
      <header>
        <h2 id="detailtitle"></h2>
        <button type="button" id="close">Close</button>
      </header>
      <div id="detailbody"></div>
    </dialog>
    <script id="tdc-data" type="application/json">
      ${json}
    </script>
    <script>
      "use strict";
      const data = JSON.parse(document.getElementById("tdc-data").textContent);
      const $ = (id) => document.getElementById(id),
        fmt = (n) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n),
        date = (s) =>
          new Date(s).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
      const text = (id, value) => {
          $(id).textContent = value;
        },
        el = (tag, value, className) => {
          const e = document.createElement(tag);
          if (value !== undefined) e.textContent = value;
          if (className) e.className = className;
          return e;
        };
      const all = [...data.findings, ...data.declared];
      let period = 0,
        page = 0,
        eventLimit = 30;
      function tab(name) {
        for (const n of ["overview", "debts", "activity"]) $(n).hidden = n !== name;
        document
          .querySelectorAll("[data-tab]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === name)));
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
      text("project", data.project);
      text("branch", data.branch + (data.commit ? " · " + data.commit : ""));
      text("snapshot", data.source);
      text("generated", "Snapshot · " + date(data.generatedAt));
      text("debtcount", "(" + all.length + ")");
      text("outstanding", fmt(data.debt) + " ");
      $("outstanding").append(el("span", "TDC"));
      text(
        "price",
        "≈ " +
          fmt(data.price.manDays) +
          " workdays · " +
          fmt(data.price.amount) +
          " " +
          data.price.currency +
          " estimated"
      );
      text(
        "declaredtotal",
        fmt(data.declared.reduce((s, d) => s + d.cost, 0)) + " declared TDC · outside balance"
      );
      function history() {
        return data.history.filter(
          (e) => !period || Date.parse(e.date) >= Date.parse(data.generatedAt) - period * 86400000
        );
      }
      const ns = "http://www.w3.org/2000/svg";
      function svgEl(tag, attrs, value) {
        const e = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
        if (value !== undefined) e.textContent = value;
        return e;
      }
      function draw() {
        const events = history();
        text("paid", "−" + fmt(events.reduce((s, e) => s + e.paid, 0)));
        text("created", "+" + fmt(events.reduce((s, e) => s + e.created, 0)));
        const host = $("chart");
        host.replaceChildren();
        if (!events.length) {
          host.append(
            el(
              "p",
              "No committed ledger in this period. Commit a ledger to start tracking repayments.",
              "empty"
            )
          );
          return;
        }
        const w = Math.max(host.clientWidth, 250),
          h = 260,
          left = 58,
          right = 22,
          top = 28,
          bottom = 42,
          max =
            Math.max(
              events.reduce((max, e) => Math.max(max, e.debt), 1),
              data.goal ? data.goal.debt : 0
            ) * 1.12,
          x = (i) => left + (w - left - right) * (events.length === 1 ? 0.5 : i / (events.length - 1)),
          y = (n) => h - bottom - ((h - top - bottom) * n) / max;
        const svg = svgEl("svg", {
          viewBox: "0 0 " + w + " " + h,
          class: "chart",
          role: "img",
          "aria-label":
            "Committed technical debt in TDC, in commit order. Baseline changes interrupt the line.",
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
            svgEl("line", {
              x1: left,
              y1: y(data.goal.debt),
              x2: w - right,
              y2: y(data.goal.debt),
              class: "goal",
            })
          );
        }
        let points = [];
        function segment() {
          if (points.length) svg.append(svgEl("polyline", { points: points.join(" "), class: "debt" }));
          points = [];
        }
        events.forEach((e, i) => {
          if (e.kind !== "scored") {
            segment();
            svg.append(svgEl("line", { x1: x(i), y1: top, x2: x(i), y2: h - bottom, class: "baseline" }));
          }
          points.push(x(i) + "," + y(e.debt));
        });
        segment();
        const selected = [...new Set([0, Math.floor((events.length - 1) / 2), events.length - 1])];
        events.forEach((e, i) => {
          const c = svgEl("circle", {
            cx: x(i),
            cy: y(e.debt),
            r: events.length > 150 ? 2 : 4,
            fill: "var(--gold)",
          });
          c.append(
            svgEl(
              "title",
              {},
              date(e.date) + " · " + e.sha.slice(0, 7) + " · " + fmt(e.debt) + " TDC · " + e.subject
            )
          );
          svg.append(c);
        });
        const labels = w < 440 ? [0, events.length - 1] : selected;
        [...new Set(labels)].forEach((i) =>
          svg.append(
            svgEl(
              "text",
              {
                x: x(i),
                y: h - 12,
                "text-anchor":
                  events.length === 1
                    ? "middle"
                    : i === 0
                    ? "start"
                    : i === events.length - 1
                    ? "end"
                    : "middle",
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
            document
              .querySelectorAll("[data-days]")
              .forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
            draw();
          })
      );
      new ResizeObserver(() => {
        if (!$("overview").hidden) draw();
      }).observe($("chart"));
      draw();
      const totals = new Map();
      data.findings.forEach((f) => totals.set(f.file, (totals.get(f.file) || 0) + f.cost));
      const files = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
      if (!files.length) $("files").append(el("p", "No measured debt. Keep the balance clean.", "muted"));
      files.forEach(([file, cost]) => {
        const b = el("button", undefined, "filebutton");
        b.type = "button";
        const label = el("div", undefined, "barlabel");
        label.append(el("span", file, "filename mono"), el("span", fmt(cost) + " TDC", "number"));
        const track = el("div", undefined, "track"),
          fill = el("div", undefined, "fill");
        fill.style.width = (cost / Math.max(files[0][1], 1)) * 100 + "%";
        track.append(fill);
        b.append(label, track);
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
      function showDebt(f) {
        text("detailtitle", f.problem);
        const body = $("detailbody");
        body.replaceChildren();
        body.append(
          el("span", f.source === "code-analyzer" ? "Measured debt" : "Declared · " + f.source, "tag"),
          el("span", fmt(f.cost) + " TDC", "tag number"),
          el("span", f.rule, "tag mono")
        );
        if (f.severity) body.append(el("span", f.severity, "tag"));
        body.append(
          el("p", f.file + (f.line ? ":" + f.line : ""), "mono"),
          el("pre", f.snippet || "No source snippet available."),
          el("p", "Finding ID: " + f.id, "muted mono")
        );
        const command = "sf tdc verify --id " + f.id;
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
        if (f.source !== "code-analyzer")
          body.append(el("p", "Declared debt is outside the ledger and coin calculations.", "muted"));
        $("detail").showModal();
      }
      $("close").onclick = () => $("detail").close();
      const priority = [...data.findings]
        .sort((a, b) => b.cost - a.cost || a.file.localeCompare(b.file))
        .slice(0, 4);
      if (!priority.length) $("next").append(el("p", "No measured findings to collect.", "empty"));
      priority.forEach((f) => {
        const b = el("button", undefined, "nextitem");
        b.type = "button";
        const d = el("div");
        d.append(el("p", f.rule), el("small", f.file));
        b.append(d, el("span", fmt(f.cost) + " TDC", "cost number"));
        b.onclick = () => showDebt(f);
        $("next").append(b);
      });
      if (data.goal) {
        text("goaltitle", fmt(data.goal.debt) + " TDC by " + date(data.goal.date));
        text(
          "goaltext",
          data.debt <= data.goal.debt
            ? "Goal reached in this snapshot."
            : fmt(data.debt - data.goal.debt) + " TDC left to repay."
        );
        const lastBaseline = [...data.history].reverse().find((e) => e.kind !== "scored");
        const start = lastBaseline ? lastBaseline.debt : data.debt;
        const progress =
          start > data.goal.debt
            ? Math.max(0, Math.min(1, (start - data.debt) / (start - data.goal.debt)))
            : data.debt <= data.goal.debt
            ? 1
            : 0;
        $("goalprogress").style.width = progress * 100 + "%";
        $("goaltrack").setAttribute("role", "progressbar");
        $("goaltrack").setAttribute("aria-label", "Progress from latest baseline to goal");
        $("goaltrack").setAttribute("aria-valuemin", "0");
        $("goaltrack").setAttribute("aria-valuemax", "100");
        $("goaltrack").setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      } else {
        text("goaltitle", "Give the debt a finish line.");
        text("goaltext", "Set goal.debt and goal.date with sf tdc init.");
        $("goaltrack").hidden = true;
      }
      text(
        "forecast",
        data.forecast
          ? (data.forecast.paidPerDay > 0
              ? fmt(data.forecast.paidPerDay) + " TDC/day repaid"
              : data.forecast.paidPerDay < 0
              ? fmt(-data.forecast.paidPerDay) + " TDC/day added"
              : "Debt is stable") +
              " · committed trend since latest baseline. Linear estimate, not a delivery commitment."
          : "A forecast needs at least two commits in the same measurement baseline."
      );
      const keys = [...new Set(all.map((f) => f.rule.split(":")[0]))].sort();
      keys.forEach((k) => {
        const o = el("option", k);
        o.value = k;
        $("engine").append(o);
      });
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
          const cost = el("td");
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
            fmt(matching.filter((f) => f.source === "code-analyzer").reduce((s, f) => s + f.cost, 0)) +
            " measured TDC · " +
            fmt(matching.filter((f) => f.source !== "code-analyzer").reduce((s, f) => s + f.cost, 0)) +
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
      function showCommit(e) {
        text("detailtitle", e.subject);
        const body = $("detailbody");
        body.replaceChildren();
        body.append(
          el("p", e.sha, "mono"),
          el("p", e.author + " · " + date(e.date)),
          el("p", "Balance after commit: " + fmt(e.debt) + " TDC")
        );
        if (e.kind !== "scored")
          body.append(el("p", "New measurement baseline. No repayments or new debt are scored.", "notice"));
        for (const [label, list] of [
          ["Repaid", e.paidFindings],
          ["New debt", e.createdFindings],
        ]) {
          body.append(el("h3", label + " · " + list.length));
          list
            .slice(0, 100)
            .forEach((f) =>
              body.append(el("p", f.rule + " · " + f.file + " · " + fmt(f.cost) + " TDC", "mono"))
            );
          if (list.length > 100) body.append(el("p", "Showing the first 100 findings."));
        }
        body.append(
          el(
            "p",
            fmt(e.deleted) + " TDC removed with deleted files · " + e.moved + " findings moved.",
            "muted"
          )
        );
        $("detail").showModal();
      }
      function renderEvents() {
        $("events").replaceChildren();
        if (!data.history.length)
          $("events").append(
            el("p", "No committed ledger yet. Run sf tdc scan and commit the ledger.", "empty")
          );
        [...data.history]
          .reverse()
          .slice(0, eventLimit)
          .forEach((e) => {
            const row = el("article", undefined, "event"),
              when = el("small", date(e.date)),
              info = el("div");
            info.append(el("p", e.subject), el("small", e.author + " · " + e.sha.slice(0, 7)));
            if (e.kind !== "scored")
              info.append(
                el(
                  "p",
                  e.kind === "baseline"
                    ? "Initial baseline · no coins"
                    : "Rules / engines changed · no coins",
                  "gold"
                )
              );
            if (e.deleted) info.append(el("p", fmt(e.deleted) + " TDC removed with files", "muted"));
            const b = el("button", "Inspect commit");
            b.type = "button";
            b.onclick = () => showCommit(e);
            info.append(el("br"), b);
            const numbers = el("div", undefined, "eventnums number");
            numbers.append(
              el("span", "−" + fmt(e.paid), "paid"),
              el("span", "+" + fmt(e.created), "created"),
              el("span", fmt(e.debt) + " TDC")
            );
            row.append(when, info, numbers);
            $("events").append(row);
          });
        $("moreevents").hidden = eventLimit >= data.history.length;
      }
      $("moreevents").onclick = () => {
        eventLimit += 30;
        renderEvents();
      };
      renderEvents();
    </script>
  </body>
</html>`;
};
