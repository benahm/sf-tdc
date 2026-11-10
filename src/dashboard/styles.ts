/** Styles of the dashboard: a bank statement for the technical debt. */
export const STYLES = `
:root {
  color-scheme: dark;
  --bg: #0e1310;
  --panel: #151c17;
  --raised: #1b241e;
  --ink: #edf0e6;
  --muted: #9fa999;
  --line: #2e382f;
  --gold: #eec66c;
  --gold-deep: #b8892d;
  --soft: #262619;
  --green: #8fd3a5;
  --green-soft: #173323;
  --red: #f39a89;
  --red-soft: #3a1d18;
  --blue: #a4bddb;
  --shadow: 0 20px 80px #0006;
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f5f1e4;
  --panel: #fffdf6;
  --raised: #fbf6e8;
  --ink: #232a22;
  --muted: #5f685a;
  --line: #ddd6c2;
  --gold: #87601a;
  --gold-deep: #b8892d;
  --soft: #f0e6cc;
  --green: #22643f;
  --green-soft: #dcefe2;
  --red: #a33b2f;
  --red-soft: #f8e1dc;
  --blue: #365a88;
  --shadow: 0 20px 80px #3a2f1a1f;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button, input, select { font: inherit; color: inherit; }
button {
  cursor: pointer;
  background: none;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 7px 12px;
}
button:hover { background: var(--soft); }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 4px;
}
button[aria-pressed="true"] { background: var(--soft); color: var(--gold); }
button:disabled { opacity: 0.45; cursor: default; }
input, select {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 9px 12px;
  min-width: 0;
}
h1, h2, h3, p { margin: 0; }
h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.3px; }
h2 { font-size: 18px; font-weight: 600; }
h3 { font-size: 15px; }
small, .muted { color: var(--muted); }
.mono, code, .number { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.number { font-variant-numeric: tabular-nums; }
.gold { color: var(--gold); }
.paid { color: var(--green); }
.created { color: var(--red); }
.eyebrow {
  font-size: 11px;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}
.app { max-width: 1280px; margin: auto; padding: 0 40px 40px; }
.top {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px 18px;
  flex-wrap: wrap;
  padding: 14px 0;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.brand { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700; letter-spacing: 1px; }
.brandname { display: flex; flex-direction: column; line-height: 1.1; }
.brand small { font-weight: 400; font-size: 11px; letter-spacing: 0.3px; margin-top: 2px; }
.coin { width: 34px; height: 34px; flex: none; filter: drop-shadow(0 2px 3px #0005); }
.coinicon { width: 0.95em; height: 0.95em; vertical-align: -0.12em; flex: none; filter: drop-shadow(0 1px 1px #0003); }
.project { border-left: 1px solid var(--line); padding-left: 18px; overflow-wrap: anywhere; }
.tag {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  overflow-wrap: anywhere;
}
.nav { display: flex; gap: 4px; margin-left: auto; }
.nav button { border: 0; padding: 7px 12px; color: var(--muted); white-space: nowrap; }
.nav button:hover { color: var(--ink); }
.nav button[aria-pressed="true"] { color: var(--gold); background: var(--soft); }
.count {
  display: inline-block;
  margin-left: 4px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--line);
  color: var(--ink);
  font-size: 11px;
  line-height: 18px;
  vertical-align: 1px;
}
.theme-toggle[aria-pressed] {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  background: var(--panel);
  color: var(--ink);
}
.theme-toggle[aria-pressed]:hover {
  border-color: var(--gold-deep);
  background: var(--soft);
  color: var(--gold);
}
.theme-toggle svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.theme-toggle[aria-pressed="false"] .theme-sun,
.theme-toggle[aria-pressed="true"] .theme-moon { display: none; }
main > section { padding-top: 26px; }

/* Statement of account */
.statement {
  position: relative;
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.stmt-main { padding: 30px 32px 26px; }
.stmt-side {
  position: relative;
  padding: 62px 32px 26px;
  border-left: 1px dashed var(--line);
  background: var(--raised);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.stmt-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.balance {
  font-size: 54px;
  line-height: 1.1;
  letter-spacing: -2px;
  margin: 6px 0 4px;
  color: var(--red);
  overflow-wrap: anywhere;
}
.balance.zero { color: var(--green); }
.balance b { font-weight: 400; }
.balance span { font-size: 16px; letter-spacing: 0; color: var(--muted); }
.drift {
  display: inline-block;
  margin-top: 12px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--soft);
}
.drift.up { background: var(--red-soft); color: var(--red); }
.drift.down { background: var(--green-soft); color: var(--green); }
.freedom { font-size: 30px; letter-spacing: -0.8px; line-height: 1.2; margin: 4px 0; }
.stamp {
  position: absolute;
  top: 18px;
  right: 22px;
  padding: 4px 12px;
  border: 3px double currentColor;
  border-radius: 6px;
  font: 800 14px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 2px;
  text-transform: uppercase;
  transform: rotate(-8deg);
  opacity: 0.85;
}
.stamp.good { color: var(--green); }
.stamp.bad { color: var(--red); }
.stamp.neutral { color: var(--gold); }

/* Credits and debits of the period */
.ledgerline {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin: 20px 0 22px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
}
.kpi { padding: 16px 20px; }
.kpi + .kpi { border-left: 1px solid var(--line); }
.kpi .value { font-size: 26px; letter-spacing: -0.8px; margin: 6px 0 0; }
.kpi small { font-size: 12px; }

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
.debt-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; }
.periods { display: flex; gap: 5px; }
.periods button { font-size: 12px; padding: 5px 9px; }
#chart { position: relative; }
.chart { width: 100%; height: auto; display: block; overflow: visible; }
.chart text { fill: var(--muted); font: 11px system-ui; }
.chart .grid { stroke: var(--line); stroke-width: 1; }
.chart .debt { stroke: var(--gold); fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.chart .area { fill: var(--gold); opacity: 0.12; }
.chart .goal { stroke: var(--blue); stroke-width: 1.5; stroke-dasharray: 6 5; }
.chart .goallabel { fill: var(--blue); font-weight: 600; }
.chart .baseline { stroke: var(--muted); stroke-dasharray: 2 5; }
.chart .dot { fill: var(--gold); stroke: var(--panel); stroke-width: 1.5; }
.chart .cursor { stroke: var(--muted); stroke-width: 1; pointer-events: none; }
.chart .marker { fill: var(--panel); stroke: var(--gold); stroke-width: 2.5; pointer-events: none; }
.chart .hit { fill: transparent; cursor: pointer; outline: none; }
.chart .hit:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.tip {
  position: absolute;
  z-index: 2;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: max-content;
  max-width: min(280px, 100%);
  padding: 8px 12px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 30px #0004;
  font-size: 12px;
  pointer-events: none;
}
.tip strong { font-size: 16px; font-weight: 600; }
.tip .subject { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legend { display: flex; gap: 20px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-top: 14px; }
.legend span::before {
  content: "";
  display: inline-block;
  width: 14px;
  height: 2px;
  background: var(--gold);
  vertical-align: middle;
  margin-right: 7px;
}
.legend .reference::before, .legend .target::before { height: 0; background: none; border-top: 2px dashed var(--muted); }
.legend .target::before { border-color: var(--blue); }
.statement > *, .split > *, .ledgerline > *, .podium > *, .objective > * { min-width: 0; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }

/* Collection notices: the files that owe the most */
.notices, .categories { display: flex; flex-direction: column; gap: 2px; margin: 0 -12px; }
.debtor, .category {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-color: transparent;
  border-radius: 10px;
}
.debtor:hover, .category:hover { background: var(--raised); border-color: var(--line); }
.debtor .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 8px; }
.debtor .who { min-width: 0; }
.debtor .path { display: block; font-size: 13px; }
.path { overflow-wrap: anywhere; font-size: 12px; }
.path .dir { color: var(--muted); }
.path .base { color: var(--ink); }
.debtor .owed { color: var(--red); white-space: nowrap; }
.hp { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted); }
.track { flex: 1; height: 7px; background: var(--line); border-radius: 4px; overflow: hidden; }
.fill { height: 100%; background: var(--gold); border-radius: 4px; }
.hp .fill { background: linear-gradient(90deg, var(--red), var(--gold)); }

/* Bounties: the next debts to collect */
.bounty {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 14px;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  position: relative;
}
.bounty:last-child { margin-bottom: 0; }
.bounty:hover { border-color: var(--gold); border-style: solid; }
.bounty p, .bounty small { overflow-wrap: anywhere; }
.bounty p { font-size: 13px; }
.bounty small { font-size: 12px; }
.bounty .what { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.bountyboard { margin-top: 20px; }
.split.inner { margin-top: 0; }
.split.inner h3 { font-size: 15px; margin: 0; }
.split.inner > div > p.muted { font-size: 12px; margin: 2px 0 12px; }

/* Debt by category */
.category .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 6px; }
.category .name { font-weight: 600; }
.category .track { margin-bottom: 4px; }
.category .fill { background: var(--gold-deep); }
.category small { font-size: 11px; }
.hint { font-size: 12px; margin-top: 12px; }
dialog a { color: var(--gold); }
.reward {
  grid-row: 1 / span 2;
  grid-column: 2;
  align-self: center;
  text-align: right;
  white-space: nowrap;
}
.reward strong { display: block; color: var(--gold); font-size: 15px; }
.reward small { font-size: 11px; }

/* Objective: progress toward the goal */
.objective { margin-top: 20px; }
.slot { position: relative; height: 18px; margin: 14px 0 26px; background: var(--line); border-radius: 999px; }
.slot .fill {
  border-radius: 999px;
  background: repeating-linear-gradient(90deg, var(--gold) 0 14px, var(--gold-deep) 14px 16px);
}
.milestone {
  position: absolute;
  top: 24px;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.milestone.reached { color: var(--gold); font-weight: 600; }
.milestone::before {
  content: "";
  position: absolute;
  left: 50%;
  top: -10px;
  width: 1px;
  height: 6px;
  background: currentColor;
}

/* Collectors */
.podium {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: end;
  margin-bottom: 24px;
}
.step {
  text-align: center;
  padding: 18px 12px 16px;
  border: 1px solid var(--line);
  border-radius: 12px 12px 4px 4px;
  background: var(--panel);
  overflow-wrap: anywhere;
}
.step.p1 { padding-top: 34px; border-color: var(--gold); background: linear-gradient(var(--soft), var(--panel)); }
.step.p2 { padding-top: 24px; }
.step .medal { font-size: 34px; line-height: 1; }
.step .coins { font-size: 22px; color: var(--gold); margin-top: 6px; }
.players td { vertical-align: middle; }
.rankbar { min-width: 140px; }
.rankbar .track { margin: 4px 0 2px; height: 6px; }
.ladder { display: flex; gap: 8px; flex-wrap: wrap; }
.ladder .tag { padding: 6px 10px; }

.sev {
  display: inline-block;
  padding: 2px 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.sev-critical, .sev-high { color: var(--red); background: var(--red-soft); border-color: transparent; }
.sev-critical { font-weight: 700; }
.sev-moderate { color: var(--gold); background: var(--soft); border-color: transparent; }
.sev-low { color: var(--blue); }
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
.toolbar input { flex: 2; min-width: 160px; }
.toolbar select { flex: 1; min-width: 140px; }
.toolbar button { color: var(--gold); }
.notice {
  padding: 12px 16px;
  border-left: 2px solid var(--gold);
  background: var(--soft);
  font-size: 13px;
  margin: 16px 0;
}
.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; text-align: left; }
th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  font-weight: 500;
  padding: 12px;
}
th.num, td.num { text-align: right; }
td { padding: 14px 12px; border-top: 1px solid var(--line); vertical-align: top; font-size: 13px; }
td button {
  border: 0;
  padding: 0;
  text-align: left;
  border-radius: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
td button:hover { background: none; text-decoration: underline; }
tr.click { cursor: pointer; }
tr.click:hover td { background: var(--raised); }
td p, td small { overflow-wrap: anywhere; }
td .number, td.num { white-space: nowrap; }
.statementtable tr.revaluation td { background: var(--soft); }
.pager { display: flex; gap: 12px; align-items: center; justify-content: end; margin-top: 16px; font-size: 13px; }
.empty { padding: 35px 16px; text-align: center; color: var(--muted); }
#moreevents { margin-top: 16px; }
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
  padding: 0;
  box-shadow: var(--shadow);
}
.sheet { padding: 26px; }
dialog::backdrop { background: #0008; }
dialog header { display: flex; align-items: start; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
dialog h2 { overflow-wrap: anywhere; }
dialog h3 { margin: 20px 0 8px; }
#close { border: 0; padding: 4px 9px; font-size: 16px; line-height: 1.2; color: var(--muted); flex: none; }
.command { display: flex; gap: 10px; align-items: center; }
.command pre { flex: 1; margin: 0; min-width: 0; }
.change {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  font-size: 13px;
}
.change .number { white-space: nowrap; }
dialog pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--bg);
  padding: 16px;
  border-radius: 7px;
  font-size: 13px;
}
dialog .tag, dialog .sev { display: inline-block; margin: 0 6px 8px 0; }
dialog p { margin: 12px 0; overflow-wrap: anywhere; }
dialog p.mono { font-size: 13px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
[hidden] { display: none !important; }

/* Coin rain, only when the latest commit repaid debt and motion is welcome */
.rain { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 10; }
.rain span { position: absolute; top: -40px; font-size: 22px; animation: fall linear forwards; }
@keyframes fall {
  to { transform: translateY(110vh) rotate(540deg); opacity: 0.2; }
}
@media (prefers-reduced-motion: no-preference) {
  button { transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .fill { transition: width 0.9s ease-out; }
  .stamp { animation: stamp 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) 0.4s both; }
  @keyframes stamp {
    from { transform: rotate(-8deg) scale(2.2); opacity: 0; }
  }
}
@media (max-width: 860px) {
  .app { padding: 0 20px 28px; }
  .split, .statement { grid-template-columns: 1fr; }
  .stmt-side { border-left: 0; border-top: 1px dashed var(--line); }
  .ledgerline { grid-template-columns: 1fr 1fr; }
  .kpi:nth-child(3) { border-left: 0; }
  .kpi:nth-child(n + 3) { border-top: 1px solid var(--line); }
  .balance { font-size: 40px; }
  .project { max-width: 60%; }
  .nav { order: 9; flex-basis: 100%; margin: 0 -6px; overflow-x: auto; }
  .brand small { display: none; }
  #theme { margin-left: auto; }
}
@media (max-width: 680px) {
  #branch { display: none; }
}
@media (max-width: 520px) {
  .stmt-main, .stmt-side, .panel { padding: 18px; }
  .top { gap: 8px 12px; padding: 10px 0; }
  .project { border-left: 0; padding-left: 0; }
  .command { flex-direction: column; align-items: stretch; }
  .podium { grid-template-columns: 1fr; }
  .step { order: 0 !important; }
  .pager { justify-content: start; flex-wrap: wrap; }
}
`;
