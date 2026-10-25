import path from 'node:path';

import { git } from '../project/git.js';
import type { Project } from '../project/project.js';

/**
 * A change that makes debt disappear without fixing it:
 * - `SUPPRESSION_ADDED`: a comment or an annotation that hides a violation (NOPMD, @SuppressWarnings...);
 * - `CONFIG_CHANGED`: a file that decides what is scanned or how (.forceignore, code-analyzer.yml...).
 */
export type Cheat = {
  code: 'SUPPRESSION_ADDED' | 'CONFIG_CHANGED';
  /** Relative to the project root. */
  file: string;
  line?: number;
  fix: string;
};

const SUPPRESSION = /NOPMD|@SuppressWarnings|eslint-disable|code-analyzer-suppress/i;
const CONFIG_FILES = new Set(['.forceignore', 'code-analyzer.yml', 'code-analyzer.yaml', 'sfdx-project.json']);
const ESLINT_CONFIG = /^(\.eslintrc(\.\w+)?|eslint\.config\.[cm]?[jt]s)$/;

const isConfig = (file: string): boolean =>
  file === '.tdc/config.json' ||
  CONFIG_FILES.has(path.posix.basename(file)) ||
  ESLINT_CONFIG.test(path.posix.basename(file));

const lines = (output: string): string[] => output.split('\n').filter((line) => line.trim());

/** Files changed since `base`, relative to the project root, the deleted ones apart. */
export const changedFiles = async (
  project: Project,
  base: string
): Promise<{ changed: string[]; deleted: Set<string> }> => {
  const [tracked, deleted, untracked] = await Promise.all([
    git(project.root, ['diff', base, '--name-only', '--relative']),
    git(project.root, ['diff', base, '--name-only', '--relative', '--diff-filter=D']),
    git(project.root, ['ls-files', '--others', '--exclude-standard']),
  ]);
  return { changed: [...new Set([...lines(tracked), ...lines(untracked)])].sort(), deleted: new Set(lines(deleted)) };
};

/** The changes since `base` that hide debt instead of paying it. */
export const findCheats = async (project: Project, base: string, changed: string[]): Promise<Cheat[]> => {
  const cheats: Cheat[] = changed.filter(isConfig).map((file) => ({
    code: 'CONFIG_CHANGED',
    file,
    fix: `Revert the change of ${file}: changing what is scanned is not paying debt`,
  }));

  const diff = await git(project.root, ['diff', base, '-U0', '--no-color', '--no-ext-diff', '--relative']);
  let file = '';
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text.slice(4).replace(/^b\//, '');
    } else if (text.startsWith('@@')) {
      line = Number(/\+(\d+)/.exec(text)?.[1] ?? 0);
    } else if (text.startsWith('+')) {
      if (SUPPRESSION.test(text)) {
        cheats.push({
          code: 'SUPPRESSION_ADDED',
          file,
          line,
          fix: 'Remove the suppression and fix the violation',
        });
      }
      line++;
    }
  }
  return cheats;
};
