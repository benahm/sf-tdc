import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { git, showFile } from '../project/git.js';
import {
  CONFIG_FILE,
  resolveConfig,
  resolveSourceDirs,
  SFDX_PROJECT_FILE,
  TDC_DIR,
  toPosix,
  type Project,
  type SfdxProjectJson,
  type TdcConfig,
} from '../project/project.js';

/** A change that can hide debt through a suppression or by changing how the project is scanned. */
export type Cheat = {
  code: 'SUPPRESSION_ADDED' | 'CONFIG_CHANGED';
  /** Relative to the project root. */
  file: string;
  line?: number;
  fix: string;
};

type ChangedFiles = { changed: string[]; deleted: Set<string>; renamedFrom: Map<string, string> };

const SUPPRESSION = /\bNOPMD\b|@SuppressWarnings\b|\beslint-disable\b|\bcode-analyzer-suppress\b/gi;
const TDC_CONFIG = `${TDC_DIR}/${CONFIG_FILE}`;
const CONFIG_FILES = new Set(['.forceignore', 'code-analyzer.yml', 'code-analyzer.yaml']);
const ESLINT_CONFIG = /^(\.eslintrc(\.\w+)?|eslint\.config\.[cm]?[jt]s)$/;

/** Files changed since `base`, relative to the project root, including untracked files. */
export const changedFiles = async (project: Project, base: string): Promise<ChangedFiles> => {
  const [tracked, untracked] = await Promise.all([
    git(project.root, ['diff', '--name-status', '-z', '--relative', '--find-renames', base, '--']),
    git(project.root, ['ls-files', '-z', '--others', '--exclude-standard']),
  ]);
  const changed = new Set(untracked.split('\0').filter(Boolean));
  const deleted = new Set<string>();
  const renamedFrom = new Map<string, string>();
  const entries = tracked.split('\0');
  for (let index = 0; index < entries.length - 1; ) {
    const status = entries[index++];
    const file = entries[index++];
    changed.add(file);
    if (status === 'D') deleted.add(file);
    if (status.startsWith('R')) {
      const destination = entries[index++];
      changed.add(destination);
      renamedFrom.set(destination, file);
    }
  }
  return { changed: [...changed].sort(), deleted, renamedFrom };
};

const scanSettings = ({ ruleSelectors, rules, severityCosts, sourceDirs }: TdcConfig, root: string): object => ({
  ruleSelectors,
  rules,
  severityCosts,
  sourceDirs: new Set(sourceDirs?.map((dir) => path.resolve(root, dir))),
});

const configChanged = (project: Project, file: string, before: string | undefined): boolean => {
  try {
    if (file === TDC_CONFIG) {
      const previous = resolveConfig(JSON.parse(before ?? '{}') as Partial<TdcConfig>);
      return !isDeepStrictEqual(scanSettings(previous, project.root), scanSettings(project.config, project.root));
    }
    const previous = resolveSourceDirs(
      project.root,
      JSON.parse(before ?? '{}') as SfdxProjectJson,
      project.config.sourceDirs
    );
    return !isDeepStrictEqual(new Set(previous), new Set(project.sourceDirs));
  } catch {
    // A malformed base config cannot be compared to the current one.
    return true;
  }
};

type Suppression = { text: string; line: number };

const suppressions = (content: string): Suppression[] =>
  content
    .split('\n')
    .flatMap((text, index) => Array.from(text.matchAll(SUPPRESSION), () => ({ text: text.trim(), line: index + 1 })));

const addedSuppressions = (previous: Suppression[], current: Suppression[]): number[] => {
  const increase = current.length - previous.length;
  if (increase <= 0) return [];

  // Match existing lines first so moving one does not change which line is reported.
  const unchanged = new Map<string, number>();
  for (const { text } of previous) unchanged.set(text, (unchanged.get(text) ?? 0) + 1);
  const extra = current.filter(({ text }) => {
    const count = unchanged.get(text) ?? 0;
    if (count > 0) unchanged.set(text, count - 1);
    return count === 0;
  });
  return extra.slice(0, increase).map(({ line }) => line);
};

/** The changes since `base` that hide debt instead of paying it. */
export const findCheats = async (
  project: Project,
  base: string,
  { changed, renamedFrom }: ChangedFiles,
  scannedFiles: string[]
): Promise<Cheat[]> => {
  const prefix = toPosix(path.relative(project.gitRoot!, project.root));
  const readBefore = (file: string): Promise<string | undefined> =>
    showFile(project.root, base, path.posix.join(prefix, file));
  const scanned = new Set(scannedFiles);
  const configs = await Promise.all(
    changed.map(async (file): Promise<Cheat[]> => {
      const hidesDebt =
        file === TDC_CONFIG || file === SFDX_PROJECT_FILE
          ? configChanged(project, file, await readBefore(file))
          : CONFIG_FILES.has(file) || ESLINT_CONFIG.test(path.posix.basename(file));
      return hidesDebt
        ? [
            {
              code: 'CONFIG_CHANGED',
              file,
              fix: `Revert the change of ${file}: changing what is scanned is not paying debt`,
            },
          ]
        : [];
    })
  );
  const markers = await Promise.all(
    changed
      .filter((file) => scanned.has(file))
      .map(async (file): Promise<Cheat[]> => {
        const current = suppressions(await readFile(path.join(project.root, file), 'utf8'));
        if (!current.length) return [];
        const previous = suppressions((await readBefore(renamedFrom.get(file) ?? file)) ?? '');
        return addedSuppressions(previous, current).map((line) => ({
          code: 'SUPPRESSION_ADDED',
          file,
          line,
          fix: 'Remove the suppression and fix the violation',
        }));
      })
  );
  return [...configs.flat(), ...markers.flat()];
};
