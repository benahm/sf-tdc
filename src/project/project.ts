import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
  /** Metadata older than this API version is debt. Defaults to sourceApiVersion minus 9 (3 years of releases). */
  minApiVersion?: number;
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
  sourceApiVersion?: number;
  minApiVersion: number;
};

type SfdxProjectJson = {
  packageDirectories?: Array<{ path?: string }>;
  sourceApiVersion?: string;
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

export const loadProject = async (cwd: string, sourceDirs?: string[]): Promise<Project> => {
  const repoRoot = await gitRoot(cwd);
  const root = findUp(cwd, 'sfdx-project.json') ?? repoRoot ?? path.resolve(cwd);
  const sfdxProject = (await readJson<SfdxProjectJson>(path.join(root, 'sfdx-project.json'))) ?? {};
  const configFile = path.join(root, TDC_DIR, CONFIG_FILE);
  const stored = (await readJson<Partial<TdcConfig>>(configFile)) ?? {};
  const config: TdcConfig = {
    ...DEFAULT_CONFIG,
    ...stored,
    rules: { ...stored.rules },
    game: { ...DEFAULT_CONFIG.game, ...stored.game },
  };

  const sourceApiVersion = sfdxProject.sourceApiVersion ? Number(sfdxProject.sourceApiVersion) : undefined;
  const packageDirs = (sfdxProject.packageDirectories ?? []).flatMap((dir) => (dir.path ? [dir.path] : []));
  const dirs = sourceDirs?.length ? sourceDirs : config.sourceDirs?.length ? config.sourceDirs : packageDirs;

  return {
    root,
    gitRoot: repoRoot,
    config,
    configFile,
    ledgerFile: path.join(root, TDC_DIR, LEDGER_FILE),
    sourceDirs: (dirs.length ? dirs : ['force-app']).map((dir) => path.resolve(root, dir)),
    sourceApiVersion,
    minApiVersion: config.minApiVersion ?? (sourceApiVersion ? Math.floor(sourceApiVersion) - 9 : 50),
  };
};

export const writeConfig = async (configFile: string, config: Partial<TdcConfig>): Promise<void> => {
  await mkdir(path.dirname(configFile), { recursive: true });
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
};
