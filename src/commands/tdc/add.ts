import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import {
  declaredId,
  DebtError,
  locate,
  parseInput,
  readDeclaredDebts,
  severityOf,
  toSfError,
  writeDeclaredDebt,
  type DeclaredDebt,
} from '../../debt/declared.js';
import { unanimous, verify } from '../../debt/verifier.js';
import { loadProject, toPosix, type Project } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.add');

export type TdcAddResult = {
  debt: DeclaredDebt;
  /** File of the debt, relative to the project root: commit it. */
  file: string;
};

const readInput = async (file: string | undefined): Promise<unknown> => {
  let content: string;
  if (file) {
    content = await readFile(path.resolve(file), 'utf8');
  } else {
    if (process.stdin.isTTY) {
      throw new DebtError('NO_INPUT', 'no debt was given', 'Pipe the JSON of the debt to the command, or give --file');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Buffer));
    content = Buffer.concat(chunks).toString('utf8');
  }
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new DebtError('INVALID_JSON', (error as Error).message, 'Send one JSON object, as `sf tdc guide` shows');
  }
};

const declare = async (project: Project, value: unknown): Promise<DeclaredDebt> => {
  const input = parseInput(value);
  for (const anchor of input.anchors) {
    const file = path.join(project.root, anchor.file);
    if (!existsSync(file)) {
      throw new DebtError(
        'FILE_NOT_FOUND',
        `${anchor.file} does not exist`,
        'Give the path relative to the project root'
      );
    }
    // eslint-disable-next-line no-await-in-loop
    if (locate(await readFile(file, 'utf8'), anchor.snippet) === undefined) {
      throw new DebtError(
        'ANCHOR_NOT_FOUND',
        `the snippet is not in ${anchor.file}: ${anchor.snippet}`,
        'Copy the snippet from the file: only the spaces and line breaks can differ'
      );
    }
  }
  if (input.verifier.kind === 'pattern' && !existsSync(path.join(project.root, input.verifier.file))) {
    throw new DebtError(
      'FILE_NOT_FOUND',
      `${input.verifier.file} does not exist`,
      'Give the path relative to the project root'
    );
  }

  const id = declaredId(input);
  const existing = (await readDeclaredDebts(project)).find((debt) => debt.id === id);
  if (existing) {
    throw new DebtError(
      'DUPLICATE',
      `this debt is already declared as ${id} (${existing.status})`,
      'Declare another problem, or other anchors'
    );
  }

  // the verifier must find the debt on the code where it was found: one that answers "fixed" to anything proves nothing
  const calibration = await verify(project, input);
  if (!unanimous(calibration, 'present')) {
    throw new DebtError(
      'CALIBRATION_FAILED',
      `the verifier did not find the debt on the current code: ${calibration.map((verdict) => verdict.verdict).join(', ')}`,
      'Make the verifier match the code as it is now: a pattern that matches the file, or a more precise prompt'
    );
  }
  const severity = severityOf(input.criticality);
  return {
    id,
    source: input.source ?? 'agent',
    title: input.title,
    description: input.description,
    category: input.category,
    criticality: input.criticality,
    severity,
    cost: project.config.severityCosts[severity],
    anchors: input.anchors,
    verifier: input.verifier,
    status: 'confirmed',
    calibration,
  };
};

export default class TdcAdd extends SfCommand<TdcAddResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    file: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.file.summary'),
      exists: true,
    }),
  };

  public async run(): Promise<TdcAddResult> {
    const { flags } = await this.parse(TdcAdd);
    const project = await loadProject(process.cwd());
    let debt: DeclaredDebt;
    try {
      debt = await declare(project, await readInput(flags.file));
    } catch (error) {
      throw toSfError(error);
    }
    const file = toPosix(path.relative(project.root, await writeDeclaredDebt(project, debt)));
    this.log(messages.getMessage('info.added', [debt.id, debt.severity, debt.cost, file]));
    return { debt, file };
  }
}
