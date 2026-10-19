import { readFile } from 'node:fs/promises';

import { parseApex, type ApexFile } from '../apex/apex-file.js';
import type { SourceFile } from '../project/files.js';

export type RuleCategory = 'Apex' | 'Tests' | 'Automation' | 'UI' | 'Metadata';

/** A piece of debt as a rule reports it, before it is priced and fingerprinted. */
export type RawFinding = {
  file: SourceFile;
  line?: number;
  /**
   * What identifies the debt inside its file, independently of its line: the normalized source line, an element
   * name... Two findings of a rule with the same snippet in the same file are told apart by their order.
   */
  snippet: string;
  message: string;
};

export type Rule = {
  id: string;
  category: RuleCategory;
  /** Default cost, in TDC (minutes of work to fix one finding). */
  cost: number;
  summary: string;
  check(context: ScanContext): Promise<RawFinding[]>;
};

export type ScanContext = {
  files: SourceFile[];
  minApiVersion: number;
  read(file: SourceFile): Promise<string>;
  /** Parsed `.cls` and `.trigger` files. */
  apexFiles(): Promise<Array<{ file: SourceFile; apex: ApexFile }>>;
};

export const createContext = (files: SourceFile[], minApiVersion: number): ScanContext => {
  const contents = new Map<string, Promise<string>>();
  let apex: Promise<Array<{ file: SourceFile; apex: ApexFile }>> | undefined;
  const read = (file: SourceFile): Promise<string> => {
    let content = contents.get(file.path);
    if (!content) {
      content = readFile(file.path, 'utf8');
      contents.set(file.path, content);
    }
    return content;
  };
  return {
    files,
    minApiVersion,
    read,
    apexFiles: (): Promise<Array<{ file: SourceFile; apex: ApexFile }>> => {
      apex ??= Promise.all(
        files
          .filter((file) => file.relPath.endsWith('.cls') || file.relPath.endsWith('.trigger'))
          .map(async (file) => ({ file, apex: parseApex(file.path, await read(file)) }))
      );
      return apex;
    },
  };
};

export const filesEndingWith = (context: ScanContext, suffix: string): SourceFile[] =>
  context.files.filter((file) => file.relPath.endsWith(suffix));

export const readFilesEndingWith = (
  context: ScanContext,
  suffix: string
): Promise<Array<{ file: SourceFile; content: string }>> =>
  Promise.all(
    filesEndingWith(context, suffix).map(async (file) => ({
      file,
      content: await context.read(file),
    }))
  );
