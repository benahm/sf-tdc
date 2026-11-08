import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RuleInfo } from '../scan/engine.js';

/**
 * What the enabled rules are about: category, severity, description and documentation. The ledger only holds their
 * costs; the dashboard reads this file to explain each debt without scanning. It changes only when the rules or the
 * engines change, and nothing is scored from it.
 */
export type Catalog = { version: 1; rules: Record<string, RuleInfo> };

/** One rule per line, sorted: scanning with the same rules rewrites nothing. */
export const serializeCatalog = (rules: Record<string, RuleInfo>): string => {
  const lines = Object.keys(rules)
    .sort()
    .map((id) => {
      const { category, severity, summary, url } = rules[id];
      return `    ${JSON.stringify(id)}: ${JSON.stringify({ category, severity, summary, ...(url ? { url } : {}) })}`;
    });
  return `{\n  "version": 1,\n  "rules": ${lines.length ? `{\n${lines.join(',\n')}\n  }` : '{}'}\n}\n`;
};

export const readCatalog = async (file: string): Promise<Catalog | undefined> => {
  try {
    const catalog = JSON.parse(await readFile(file, 'utf8')) as Partial<Catalog>;
    return { version: 1, rules: catalog.rules ?? {} };
  } catch {
    // missing or unreadable: the dashboard shows the rule ids
    return undefined;
  }
};

/** Writes the catalog when it changed, and tells whether it did. */
export const writeCatalog = async (file: string, rules: Record<string, RuleInfo>): Promise<boolean> => {
  const content = serializeCatalog(rules);
  let stored: string | undefined;
  try {
    stored = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
  } catch {
    stored = undefined;
  }
  if (stored === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
};
