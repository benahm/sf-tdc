import { CLIENT } from './client.js';
import type { DashboardData } from './data.js';
import { dashboardPayload } from './payload.js';
import { STYLES } from './styles.js';

/** Escape the script-data boundary, including strings supplied by source code and commit messages. */
const scriptData = (data: object): string =>
  JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');

export const renderDashboard = (data: DashboardData): string => {
  const { overview, details } = dashboardPayload(data);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    />
    <title>TDC · Debt statement</title>
    <style>${STYLES}</style>
  </head>
  <body>
    <svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
      <defs>
              <radialGradient id="tdc-face" cx="38%" cy="30%" r="80%">
                <stop offset="0" stop-color="#fff6d2" />
                <stop offset=".4" stop-color="#f2cb6c" />
                <stop offset="1" stop-color="#b98829" />
              </radialGradient>
              <linearGradient id="tdc-rim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#fff0b8" />
                <stop offset=".45" stop-color="#dcaa46" />
                <stop offset="1" stop-color="#8d6218" />
              </linearGradient>
              <linearGradient id="tdc-side" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#7c5512" />
                <stop offset=".5" stop-color="#a87a25" />
                <stop offset="1" stop-color="#5e400b" />
              </linearGradient>
              <linearGradient id="tdc-mark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#946617" />
                <stop offset="1" stop-color="#5c3f0a" />
              </linearGradient>
            </defs>
      <symbol id="tdc-coin" viewBox="0 0 64 64">
            <ellipse cx="32" cy="35" rx="30" ry="29" fill="url(#tdc-side)" />
            <circle cx="32" cy="32" r="30" fill="url(#tdc-rim)" />
            <circle cx="32" cy="32" r="29" fill="none" stroke="#8d6218" stroke-width="1.6" stroke-dasharray=".5 .9" opacity=".45" />
            <circle cx="32" cy="32" r="25.4" fill="#a3751f" />
            <circle cx="32" cy="32.5" r="24.8" fill="url(#tdc-face)" />
            <circle cx="32" cy="32" r="21.6" fill="none" stroke="#b08128" stroke-width=".9" />
            <circle cx="32.5" cy="32.5" r="21.6" fill="none" stroke="#fff4cc" stroke-width=".5" opacity=".7" />
            <path d="M20 20h24v8.2h-2.4l-1.1-3.8h-5.4v16.8l3.2 1.3V45H25.7v-2.5l3.2-1.3V24.4h-5.4l-1.1 3.8H20z" fill="#fff4cc" opacity=".8" transform="translate(.8 .9)" />
            <path d="M20 20h24v8.2h-2.4l-1.1-3.8h-5.4v16.8l3.2 1.3V45H25.7v-2.5l3.2-1.3V24.4h-5.4l-1.1 3.8H20z" fill="url(#tdc-mark)" />
            <path d="M14 23a20 20 0 0 1 15-12.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5" />
          </symbol>
    </svg>
    <div class="app">
      <header class="top">
        <div class="brand"><svg class="coin" viewBox="0 0 64 64" aria-hidden="true"><use href="#tdc-coin" width="64" height="64" /></svg><span class="brandname">TDC<small class="muted">Technical Debt Collector</small></span></div>
        <span class="project" id="project"></span><span class="tag mono" id="branch"></span>
        <nav class="nav" aria-label="Dashboard views">
          <button type="button" data-tab="overview" aria-controls="overview" aria-pressed="true">Overview</button>
          <button type="button" data-tab="debts" aria-controls="debts" aria-pressed="false">
            Debts <span class="count" id="debtcount"></span>
          </button>
          <button type="button" data-tab="collectors" aria-controls="collectors" aria-pressed="false">
            Collectors <span class="count" id="collectorcount"></span>
          </button>
          <button type="button" data-tab="activity" aria-controls="activity" aria-pressed="false">Statement</button>
        </nav>
        <button
          id="theme"
          class="theme-toggle"
          type="button"
          aria-label="Dark theme"
          aria-pressed="true"
          title="Switch to light theme"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <g class="theme-sun">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </g>
            <path class="theme-moon" d="M20.9 13.4A9 9 0 0 1 10.6 3.1a9 9 0 1 0 10.3 10.3Z" />
          </svg>
        </button>
      </header>

      <main>
        <section id="overview" aria-label="Overview">
          <section class="statement" aria-label="Statement of account">
            <div class="stmt-main">
              <div class="stmt-head">
                <div class="eyebrow">Statement of account · measured debt</div>
                <span class="tag" id="generated"></span>
              </div>
              <h1>Balance due</h1>
              <div class="balance number" id="outstanding"><b id="outstandingvalue">0</b> <span>TDC</span></div>
              <small id="price"></small><br />
              <span class="drift" id="drift" hidden></span>
            </div>
            <div class="stmt-side">
              <span class="stamp" id="stamp" hidden></span>
              <div class="eyebrow">Debt-free by</div>
              <div class="freedom number gold" id="freedom"></div>
              <small id="pace"></small>
              <small class="muted">Linear estimate on committed ledgers, not a delivery commitment.</small>
            </div>
          </section>

          <div class="ledgerline">
            <div class="kpi">
              <div class="eyebrow">Credit · repaid</div>
              <div class="value number paid" id="paid"></div>
              <small>Findings corrected in scored commits</small>
            </div>
            <div class="kpi">
              <div class="eyebrow">Debit · new debt</div>
              <div class="value number created" id="created"></div>
              <small>Findings introduced in scored commits</small>
            </div>
            <div class="kpi">
              <div class="eyebrow">Repaying commits</div>
              <div class="value number" id="repaying"></div>
              <small>Commits that repaid more debt than they created</small>
            </div>
            <div class="kpi">
              <div class="eyebrow">Coins collected</div>
              <div class="value number gold" id="coins"></div>
              <small>Earned by the collectors</small>
            </div>
          </div>
          <div class="panel">
            <div class="panelhead">
              <div>
                <h2>The repayment trajectory</h2>
                <p class="muted" style="font-size: 13px">Committed debt · the period also sets the totals above</p>
              </div>
              <div class="periods" aria-label="History period">
                <button type="button" data-days="30" aria-pressed="false">30 days</button>
                <button type="button" data-days="90" aria-pressed="false">90 days</button>
                <button type="button" data-days="0" aria-pressed="true">All time</button>
              </div>
            </div>
            <div id="chart"></div>
            <div class="legend" id="legend">
              <span>Measured debt</span><span class="reference">New baseline</span
              ><span class="target" id="legendgoal">Goal</span>
            </div>
            <p class="muted" style="font-size: 12px; margin-top: 10px">
              Debt written off with deleted files lowers the balance. Gaps mark a new baseline after a merge,
              a break in the ledger history or a change of rules, costs or engines.
            </p>
          </div>
          <div class="split">
            <section class="panel">
              <div class="panelhead">
                <div>
                  <div class="eyebrow">Where the debt lives</div>
                  <h2>Collection notices</h2>
                </div>
                <span class="tag">Boss files</span>
              </div>
              <div class="notices" id="files"></div>
            </section>
            <section class="panel">
              <div class="panelhead">
                <div>
                  <div class="eyebrow">What the debt is made of</div>
                  <h2>Debt by category</h2>
                </div>
                <span class="tag" id="categorytag">Measured debt</span>
              </div>
              <div class="categories" id="categories"></div>
              <p class="muted hint" id="cataloghint" hidden>
                Rule descriptions and categories come from .tdc/catalog.json, written by sf tdc scan. Run a scan, then
                regenerate the report.
              </p>
            </section>
          </div>
          <section class="panel bountyboard">
            <div class="panelhead">
              <div>
                <div class="eyebrow">Your next move</div>
                <h2>Bounties</h2>
              </div>
              <span class="tag">1 TDC repaid = 1 <svg class="coinicon" viewBox="0 0 64 64" aria-label="coin" role="img"><use href="#tdc-coin" width="64" height="64" /></svg></span>
            </div>
            <div class="split inner">
              <div>
                <h3>Big bounties</h3>
                <p class="muted">The most expensive debts, one per file.</p>
                <div id="next"></div>
              </div>
              <div>
                <h3>Quick fixes</h3>
                <p class="muted">The cheapest debts, one per rule: 1 TDC is about a minute of work.</p>
                <div id="quick"></div>
              </div>
            </div>
          </section>
          <section class="panel objective">
            <div>
              <div class="eyebrow">Repayment objective</div>
              <h2 id="goaltitle"></h2>
              <p class="muted" id="goaltext"></p>
              <div id="goaltrack" class="slot"><div id="goalprogress" class="fill" style="width: 0"></div></div>
              <p class="muted" id="forecast"></p>
            </div>
          </section>
        </section>

        <section id="debts" aria-label="Debt explorer" hidden>
          <div class="panelhead">
            <div>
              <div class="debt-heading">
                <h2>The collection book</h2>
                <span class="tag">Measured debt · <strong class="number" id="measuredtotal"></strong></span>
              </div>
              <p class="muted">Inspect a debt, understand its cost, and claim its bounty.</p>
            </div>
            <span class="tag" id="declaredtotal"></span>
          </div>
          <p class="notice">
            Declared debt is tracked separately. It does not contribute to the measured balance or earn coins. Run sf
            tdc scan before generating the report to include your latest code changes.
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
            ><label class="sr" for="severity">Severity</label
            ><select id="severity">
              <option value="all">All severities</option></select
            ><label class="sr" for="engine">Category</label
            ><select id="engine">
              <option value="all">All categories</option></select
            ><label class="sr" for="sort">Sort debts</label
            ><select id="sort">
              <option value="cost">Highest cost</option>
              <option value="file">File name</option></select
            ><button type="button" id="reset" hidden>Clear filters</button>
          </div>
          <p id="results" class="muted" aria-live="polite"></p>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Finding / file</th>
                  <th scope="col">Rule / source</th>
                  <th scope="col">Severity</th>
                  <th scope="col" class="num">TDC</th>
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

        <section id="collectors" aria-label="Collectors" hidden>
          <div class="panelhead">
            <div>
              <h2>The collectors</h2>
              <p class="muted">Coins earned by repaying debt, lost by creating it. Baselines and revaluations score nothing.</p>
            </div>
            <div class="ladder" id="ladder" aria-label="Ranks"></div>
          </div>
          <div class="podium" id="podium"></div>
          <div class="tablewrap" id="players">
            <table class="players">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Collector</th>
                  <th scope="col">Rank</th>
                  <th scope="col" class="num">Repaid</th>
                  <th scope="col" class="num">New debt</th>
                  <th scope="col" class="num">Coins</th>
                </tr>
              </thead>
              <tbody id="playerrows"></tbody>
            </table>
          </div>
        </section>

        <section id="activity" aria-label="Statement of committed ledgers" hidden>
          <div class="panelhead">
            <div>
              <h2>The repayment journal</h2>
              <p class="muted">Every committed ledger as a statement line: debits, credits and running balance.</p>
            </div>
            <span class="tag">Most recent first</span>
          </div>
          <div class="tablewrap">
            <table class="statementtable">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Transaction</th>
                  <th scope="col" class="num">Debit</th>
                  <th scope="col" class="num">Credit</th>
                  <th scope="col" class="num">Balance</th>
                  <th scope="col" class="num">Coins</th>
                </tr>
              </thead>
              <tbody id="events"></tbody>
            </table>
          </div>
          <button type="button" id="moreevents" hidden>Show more commits</button>
        </section>
      </main>
      <footer class="foot">
        <span>1 TDC = 1 estimated minute of correction · Git is the source of committed history.</span
        ><span>Offline snapshot · no external services</span>
      </footer>
    </div>
    <dialog id="detail" aria-labelledby="detailtitle">
      <div class="sheet">
        <header>
          <h2 id="detailtitle"></h2>
          <button type="button" id="close" aria-label="Close">✕</button>
        </header>
        <div id="detailbody"></div>
      </div>
    </dialog>
    <script id="tdc-data" type="application/json">
      ${scriptData(overview)}
    </script>
    <script id="tdc-details" type="application/json">
      ${scriptData(details)}
    </script>
    <script>
      ${CLIENT}
    </script>
  </body>
</html>`;
};
