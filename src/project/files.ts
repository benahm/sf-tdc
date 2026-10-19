import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { ForceIgnore } from '@salesforce/source-deploy-retrieve';

import { toPosix } from './project.js';

export type SourceFile = {
  path: string;
  /** Path relative to the project root, with forward slashes: the form stored in the ledger. */
  relPath: string;
};

const SKIPPED_DIRS = new Set(['.git', '.sf', '.sfdx', '.tdc', 'node_modules', '__tests__']);

const walk = async (dir: string, forceIgnore: ForceIgnore): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : walk(full, forceIgnore);
      return entry.isFile() && !forceIgnore.denies(full) ? [full] : [];
    })
  );
  return nested.flat();
};

/** Files of the source folders, minus the ones excluded by .forceignore, sorted for stable results. */
export const listSourceFiles = async (root: string, sourceDirs: string[]): Promise<SourceFile[]> => {
  const forceIgnore = ForceIgnore.findAndCreate(root);
  const files = await Promise.all(sourceDirs.filter((dir) => existsSync(dir)).map((dir) => walk(dir, forceIgnore)));
  return [...new Set(files.flat())]
    .map((file) => ({ path: file, relPath: toPosix(path.relative(root, file)) }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
};
