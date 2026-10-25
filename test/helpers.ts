import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadProject } from '../src/project/project.js';
import type { Analyzer, AnalyzerViolation } from '../src/scan/code-analyzer.js';
import { analyzer, scan, type Finding } from '../src/scan/engine.js';

export const SFDX_PROJECT = JSON.stringify({
  packageDirectories: [{ path: 'force-app', default: true }],
  sourceApiVersion: '62.0',
});

/** Versions reported by the fake analyzer: a test can change them to simulate an upgrade of code-analyzer. */
export const fakeEngines: Record<string, string> = { core: '1.0.0', pmd: '1.0.0' };

/** Rules of the fake analyzer, each a pattern matched line by line. */
const FAKE_RULES = [
  {
    id: 'pmd:OperationWithLimitsInLoop',
    severity: 'Moderate' as const,
    // a loop and a query or a DML statement on the same line
    pattern: /\bfor\s*\(.*\{.*(\[\s*SELECT\b|\b(insert|update|delete)\s)/i,
  },
  { id: 'pmd:AvoidDebugStatements', severity: 'Low' as const, pattern: /System\.debug/ },
];

/** An analyzer that matches FAKE_RULES on the source lines: code-analyzer takes seconds to start. */
export const fakeAnalyzer: Analyzer = async (_project, files) => {
  const violations: AnalyzerViolation[] = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const lines = (await readFile(file.path, 'utf8')).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of FAKE_RULES) {
        if (rule.pattern.test(line))
          violations.push({ rule: rule.id, file: file.path, line: index + 1, message: rule.id });
      }
    });
  }
  return {
    engines: { ...fakeEngines },
    rules: FAKE_RULES.map(({ id, severity }) => ({
      id,
      severity,
      tags: ['Recommended', 'Performance'],
      description: id,
    })),
    violations,
  };
};

/** Runs the tests of the current suite with the fake analyzer. */
export const useFakeAnalyzer = (): void => {
  const real = analyzer.run;
  before(() => {
    analyzer.run = fakeAnalyzer;
  });
  after(() => {
    analyzer.run = real;
  });
};

/** A temporary Salesforce project: paths are relative to force-app/main/default. */
export const createProject = async (files: Record<string, string> = {}): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'sf-tdc-'));
  await writeFile(path.join(root, 'sfdx-project.json'), SFDX_PROJECT);
  await writeSources(root, files);
  return root;
};

export const writeSources = async (root: string, files: Record<string, string>): Promise<void> => {
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, 'force-app/main/default', file);
    // eslint-disable-next-line no-await-in-loop
    await mkdir(path.dirname(full), { recursive: true });
    // eslint-disable-next-line no-await-in-loop
    await writeFile(full, content);
  }
};

export const removeProject = (root: string): Promise<void> => rm(root, { recursive: true, force: true });

export const findingsOf = async (files: Record<string, string>, rule?: string): Promise<Finding[]> => {
  const root = await createProject(files);
  try {
    const { findings } = await scan(await loadProject(root));
    return rule ? findings.filter((finding) => finding.rule === rule) : findings;
  } finally {
    await removeProject(root);
  }
};

export const gitInit = (root: string): void => {
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
};

export const commitAll = (root: string, author: string, message: string, date = '2026-10-01T10:00:00Z'): void => {
  const email = `${author.toLowerCase()}@example.com`;
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', `user.name=${author}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', message], {
    cwd: root,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
};
