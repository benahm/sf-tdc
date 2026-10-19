import { lineSnippet, type ApexFile } from '../../apex/apex-file.js';
import type { Token } from '../../apex/lexer.js';
import type { SourceFile } from '../../project/files.js';
import type { RawFinding, ScanContext } from '../rule.js';

export type ApexCheck = (apex: ApexFile, file: SourceFile) => Array<{ token: Token; message: string }>;

const toFinding =
  (file: SourceFile, apex: ApexFile) =>
  ({ token, message }: { token: Token; message: string }): RawFinding => ({
    file,
    line: token.line,
    snippet: lineSnippet(apex, token.line),
    message,
  });

/** Runs a check on every Apex file, each finding identified by its source line. */
export const eachApexFile =
  (check: ApexCheck) =>
  async (context: ScanContext): Promise<RawFinding[]> =>
    (await context.apexFiles()).flatMap(({ file, apex }) => check(apex, file).map(toFinding(file, apex)));
