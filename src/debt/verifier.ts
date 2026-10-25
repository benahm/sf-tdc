import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Project } from '../project/project.js';
import { DebtError, normalize, type DeclaredDebt, type Verdict } from './declared.js';

const TIMEOUT = 10 * 60 * 1000;
const MAX_FILE_LENGTH = 100_000;

const readSource = async (project: Project, file: string): Promise<string | undefined> => {
  try {
    return await readFile(path.join(project.root, file), 'utf8');
  } catch {
    return undefined;
  }
};

/** Runs the agent command of .tdc/config.json with the prompt on its standard input, and returns its output. */
const runCommand = (project: Project, prompt: string): Promise<string> => {
  const command = project.config.verifier?.command;
  if (!command) {
    return Promise.reject(
      new DebtError(
        'NO_VERIFIER_COMMAND',
        'a prompt verifier needs the agent command of .tdc/config.json',
        'Set verifier.command in .tdc/config.json (for instance "claude -p" or "codex exec -"), or use a pattern verifier'
      )
    );
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd: project.root, shell: true, timeout: TIMEOUT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${command} exited with ${code ?? 'a signal'}: ${stderr.trim()}`))
    );
    child.stdin.end(prompt);
  });
};

/** The agent command of the prompt verifiers: the tests replace it. */
export const promptRunner: { run: (project: Project, prompt: string) => Promise<string> } = { run: runCommand };

const buildPrompt = (
  debt: Pick<DeclaredDebt, 'title' | 'description' | 'verifier'>,
  files: Map<string, string>
): string =>
  [
    'You verify whether a problem is still present in a Salesforce project. Answer from the files below only.',
    '',
    `Problem: ${debt.title}`,
    debt.description,
    '',
    `Question: ${debt.verifier.kind === 'prompt' ? debt.verifier.prompt : ''}`,
    '',
    ...[...files].flatMap(([file, content]) => [`--- ${file}`, content.slice(0, MAX_FILE_LENGTH), '']),
    'Answer with one JSON object and nothing else:',
    '{"verdict": "present" | "fixed" | "unclear", "evidence": "<the exact code that shows it, copied from a file above>"}',
    'Answer "present" or "fixed" only when the code shows it; otherwise answer "unclear".',
  ].join('\n');

/** The verdict in the output of the agent: its last JSON object with a verdict, even inside a JSON envelope. */
export const parseVerdict = (output: string): Verdict => {
  let text = output;
  try {
    const envelope = JSON.parse(output) as { result?: unknown };
    if (typeof envelope.result === 'string') text = envelope.result;
  } catch {
    // plain text
  }
  for (const candidate of (text.match(/\{[^{}]*"verdict"[^{}]*\}/g) ?? []).reverse()) {
    try {
      const parsed = JSON.parse(candidate) as Partial<Verdict>;
      if (parsed.verdict === 'present' || parsed.verdict === 'fixed' || parsed.verdict === 'unclear') {
        return {
          verdict: parsed.verdict,
          ...(typeof parsed.evidence === 'string' ? { evidence: parsed.evidence } : {}),
        };
      }
    } catch {
      // not JSON
    }
  }
  return { verdict: 'unclear', evidence: 'no verdict in the output of the agent' };
};

const runPattern = async (project: Project, file: string, pattern: string): Promise<Verdict> => {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'm');
  } catch (error) {
    throw new DebtError(
      'INVALID_PATTERN',
      (error as Error).message,
      'Give verifier.pattern as a JavaScript regular expression'
    );
  }
  const content = await readSource(project, file);
  if (content === undefined) return { verdict: 'fixed', evidence: `${file} does not exist` };
  const match = regex.exec(content);
  return match ? { verdict: 'present', evidence: match[0] } : { verdict: 'fixed' };
};

/**
 * Asks the verifier of a debt whether it is still there. A pattern answers once, deterministically. A prompt is asked
 * `runs` times, and a "present" whose evidence is not in the files is unclear: the agent made it up.
 */
export const verify = async (
  project: Project,
  debt: Pick<DeclaredDebt, 'title' | 'description' | 'anchors' | 'verifier'>
): Promise<Verdict[]> => {
  if (debt.verifier.kind === 'pattern') return [await runPattern(project, debt.verifier.file, debt.verifier.pattern)];

  const files = new Map<string, string>();
  for (const file of new Set(debt.anchors.map((anchor) => anchor.file))) {
    // eslint-disable-next-line no-await-in-loop
    const content = await readSource(project, file);
    if (content !== undefined) files.set(file, content);
  }
  const corpus = normalize([...files.values()].join('\n'));
  const prompt = buildPrompt(debt, files);
  const verdicts: Verdict[] = [];
  for (let run = 0; run < (project.config.verifier?.runs ?? 3); run++) {
    let verdict: Verdict;
    try {
      // one run at a time: agent commands don't like to share a working folder
      // eslint-disable-next-line no-await-in-loop
      verdict = parseVerdict(await promptRunner.run(project, prompt));
    } catch (error) {
      if (error instanceof DebtError) throw error;
      verdict = { verdict: 'unclear', evidence: (error as Error).message };
    }
    if (verdict.verdict === 'present' && !(verdict.evidence && corpus.includes(normalize(verdict.evidence)))) {
      verdict = { verdict: 'unclear', evidence: `evidence not found in the files: ${verdict.evidence ?? ''}` };
    }
    verdicts.push(verdict);
  }
  return verdicts;
};

/** Every verdict agrees: one dissenting or unclear run keeps the previous status. */
export const unanimous = (verdicts: Verdict[], verdict: Verdict['verdict']): boolean =>
  verdicts.length > 0 && verdicts.every((item) => item.verdict === verdict);
