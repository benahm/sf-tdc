import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './index.module.css';

type Feature = {title: string; description: ReactNode};

const features: Feature[] = [
  {
    title: 'The debt has a price',
    description: (
      <>
        17 rules find queries in loops, tests without assertions, Process Builders, Aura components... Each finding
        costs TDC, minutes of work, also shown in man-days and in money.
      </>
    ),
  },
  {
    title: 'The ledger lives in git',
    description: (
      <>
        <code>.tdc/ledger.json</code> holds one finding per line, without line numbers. A pull request shows the debt
        it pays as removed lines.
      </>
    ),
  },
  {
    title: 'Whoever pays, earns',
    description: (
      <>
        Each commit is compared with its parent: its author earns the TDC (Technical Debt Coins) of the debt that disappeared, and loses the
        debt that appeared. Renames and moves don't count.
      </>
    ),
  },
  {
    title: 'A game for the team',
    description: (
      <>
        Ranks, badges, a leaderboard per sprint, a goal and a payoff date. And a CI check so that the debt never
        grows.
      </>
    ),
  },
];

const SAMPLE = `sf tdc scan

💰 Technical debt: 48,320 TDC (≈ 115.0 man-days · 69,029 EUR) · rating C
Since the last ledger: paid 1,240 TDC 🎉 · new debt +90 TDC
👹 Boss: force-app/main/default/classes/InvoiceService.cls (4,210 HP)`;

function Hero(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.hero)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className={clsx('hero__subtitle', styles.tagline)}>{siteConfig.tagline}</p>
        <div className={styles.command}>
          <CodeBlock language="text">{SAMPLE}</CodeBlock>
        </div>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/getting-started">
            Get started
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/guides/game">
            The game
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout description="Salesforce CLI plugin: price the technical debt, track who pays it back in git, and make a game of it.">
      <Hero />
      <main className="container margin-vert--xl">
        <div className="row">
          {features.map((feature) => (
            <div key={feature.title} className={clsx('col col--3', styles.feature)}>
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
