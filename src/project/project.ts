import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Severity } from '../scan/code-analyzer.js';
import { gitRoot } from './git.js';

export const TDC_DIR = '.tdc';
export const CONFIG_FILE = 'config.json';
export const LEDGER_FILE = 'ledger.json';

export type RuleSetting = {
  enabled?: boolean;
  cost?: number;
};

export type Goal = {
  /** Debt to reach, in TDC. */
  debt: number;
  /** Deadline, as YYYY-MM-DD. */
  date: string;
};

export type TdcConfig = {
  /** Folders to scan, relative to the project root. Defaults to the packageDirectories of sfdx-project.json. */
  sourceDirs?: string[];
  /** Rule selectors of code-analyzer: engines, tags, severities or `engine:rule`, combined with a colon. */
  ruleSelectors: string[];
  /** Cost of a finding, in TDC, by severity of its rule. A rule of `rules` can have its own cost. */
  severityCosts: Record<Severity, number>;
  /** Cost of a day of work, to price the debt. */
  dailyRate: number;
  currency: string;
  hoursPerDay: number;
  rules: Record<string, RuleSetting>;
  goal?: Goal;
  game: {
    /** Whether deleting a whole file earns the coins of its debt. */
    rewardDeletedFiles: boolean;
  };
};

export const DEFAULT_CONFIG: TdcConfig = {
  dailyRate: 600,
  currency: 'EUR',
  hoursPerDay: 7,
  ruleSelectors: ['Recommended'],
  severityCosts: { Critical: 60, High: 30, Moderate: 15, Low: 5, Info: 2 },
  rules: {},
  game: { rewardDeletedFiles: false },
};

export type Project = {
  /** Folder holding sfdx-project.json (or the repository root without one). */
  root: string;
  /** Root of the git repository, when there is one. */
  gitRoot?: string;
  config: TdcConfig;
  configFile: string;
  ledgerFile: string;
  sourceDirs: string[];
};

type SfdxProjectJson = {
  packageDirectories?: Array<{ path?: string }>;
};

const findUp = (start: string, file: string): string | undefined => {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, file))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
};

const readJson = async <T>(file: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`, { cause: error });
  }
};

export const toPosix = (file: string): string => file.split(path.sep).join('/');

/**
 * The canonical form of an existing path: git prints long paths, while a Windows temporary folder can be given in its
 * short 8.3 form (RUNNER~1), and paths relative to each other would then be wrong.
 */
const canonical = (file: string): string => realpathSync.native(path.resolve(file));

export const loadProject = async (cwd: string, sourceDirs?: string[]): Promise<Project> => {
  const gitTopLevel = await gitRoot(cwd);
  const repoRoot = gitTopLevel ? canonical(gitTopLevel) : undefined;
  const root = canonical(findUp(cwd, 'sfdx-project.json') ?? repoRoot ?? cwd);
  const sfdxProject = (await readJson<SfdxProjectJson>(path.join(root, 'sfdx-project.json'))) ?? {};
  const configFile = path.join(root, TDC_DIR, CONFIG_FILE);
  const stored = (await readJson<Partial<TdcConfig>>(configFile)) ?? {};
  const config: TdcConfig = {
    ...DEFAULT_CONFIG,
    ...stored,
    severityCosts: { ...DEFAULT_CONFIG.severityCosts, ...stored.severityCosts },
    rules: { ...stored.rules },
    game: { ...DEFAULT_CONFIG.game, ...stored.game },
  };

  const packageDirs = (sfdxProject.packageDirectories ?? []).flatMap((dir) => (dir.path ? [dir.path] : []));
  const dirs = sourceDirs?.length ? sourceDirs : config.sourceDirs?.length ? config.sourceDirs : packageDirs;

  return {
    root,
    gitRoot: repoRoot,
    config,
    configFile,
    ledgerFile: path.join(root, TDC_DIR, LEDGER_FILE),
    sourceDirs: (dirs.length ? dirs : ['force-app']).map((dir) => path.resolve(root, dir)),
  };
};

export const writeConfig = async (configFile: string, config: Partial<TdcConfig>): Promise<void> => {
  await mkdir(path.dirname(configFile), { recursive: true });
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
};
