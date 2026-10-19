import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadProject } from '../src/project/project.js';
import { scan, type Finding } from '../src/scan/engine.js';

export const SFDX_PROJECT = JSON.stringify({
  packageDirectories: [{ path: 'force-app', default: true }],
  sourceApiVersion: '62.0',
});

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
