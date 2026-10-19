import path from 'node:path';

import { isPunct, isWord, matchBrackets, tokenize, type Token } from './lexer.js';

export type ApexFile = {
  /** Class or trigger name, from the file name. */
  name: string;
  isTrigger: boolean;
  isTest: boolean;
  /** Every token, comments included. */
  tokens: Token[];
  /** Tokens without the comments. */
  code: Token[];
  /** Matching brackets of `code`. */
  matches: Map<number, number>;
  /** Number of loops enclosing each token of `code`. */
  loopDepth: number[];
  lines: string[];
};

/** End (inclusive) of the statement starting at `start`: its `;`, or the block it opens. */
const statementEnd = (code: Token[], matches: Map<number, number>, start: number): number => {
  for (let i = start; i < code.length; i++) {
    const close = matches.get(i);
    if (isPunct(code[i], '{') && close !== undefined) return close;
    if ((isPunct(code[i], '(') || isPunct(code[i], '[')) && close !== undefined) {
      i = close;
    } else if (isPunct(code[i], ';')) {
      return i;
    }
  }
  return code.length - 1;
};

/**
 * Ranges of tokens executed once per iteration: the bodies of `for`, `while` and `do`. The header of a `for` is not
 * part of it: the query of `for (Account a : [SELECT ...])` runs once.
 */
const loopBodies = (code: Token[], matches: Map<number, number>): Array<[number, number]> => {
  const bodies: Array<[number, number]> = [];
  code.forEach((token, index) => {
    if (isWord(token, 'for', 'while') && isPunct(code[index + 1], '(')) {
      const close = matches.get(index + 1);
      // the `while (...)` closing a do-while has no body
      if (close === undefined || isPunct(code[close + 1], ';')) return;
      bodies.push([close + 1, statementEnd(code, matches, close + 1)]);
    } else if (isWord(token, 'do') && isPunct(code[index + 1], '{')) {
      const close = matches.get(index + 1);
      if (close !== undefined) bodies.push([index + 1, close]);
    }
  });
  return bodies;
};

const hasTestAnnotation = (code: Token[]): boolean =>
  code.some((token, index) => isPunct(token, '@') && isWord(code[index + 1], 'istest')) ||
  code.some((token) => isWord(token, 'testmethod'));

export const parseApex = (filePath: string, source: string): ApexFile => {
  const tokens = tokenize(source);
  const code = tokens.filter((token) => token.kind !== 'comment');
  const matches = matchBrackets(code);
  const loopDepth = Array.from({ length: code.length }, () => 0);
  for (const [start, end] of loopBodies(code, matches)) {
    for (let i = start; i <= end; i++) loopDepth[i]++;
  }
  const isTrigger = filePath.endsWith('.trigger');
  return {
    name: path.basename(filePath).replace(/\.(cls|trigger)$/, ''),
    isTrigger,
    isTest: !isTrigger && hasTestAnnotation(code),
    tokens,
    code,
    matches,
    loopDepth,
    lines: source.split(/\r?\n/),
  };
};

/** The source line of a token, trimmed with its spaces collapsed: what a finding is recognized by. */
export const lineSnippet = (file: ApexFile, line: number): string =>
  (file.lines[line - 1] ?? '').trim().replace(/\s+/g, ' ');
