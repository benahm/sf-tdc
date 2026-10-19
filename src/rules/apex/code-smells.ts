import { isPunct, isWord, type Token } from '../../apex/lexer.js';
import type { Rule } from '../rule.js';
import { eachApexFile } from './apex-rule.js';

/** 15 or 18 characters: a 3-character key prefix, 2 for the pod, a reserved `0`, then the record number. */
const SALESFORCE_ID = /^[a-zA-Z0-9]{5}0[a-zA-Z0-9]{9}([a-zA-Z0-9]{3})?$/;

const looksLikeId = (text: string): boolean => SALESFORCE_ID.test(text) && (text.match(/\d/g) ?? []).length >= 3;

export const hardcodedId: Rule = {
  id: 'apex-hardcoded-id',
  category: 'Apex',
  cost: 15,
  summary: 'Hardcoded record ID: it differs between orgs and breaks after a sandbox refresh.',
  check: eachApexFile(({ code }) =>
    code
      .filter((token) => token.kind === 'string' && looksLikeId(token.text))
      .map((token) => ({
        token,
        message: `Hardcoded ID '${token.text}': query it or use custom metadata.`,
      }))
  ),
};

export const emptyCatch: Rule = {
  id: 'apex-empty-catch',
  category: 'Apex',
  cost: 10,
  summary: 'Empty catch block: the error is silently swallowed.',
  // on every token, so that a comment explaining why the catch is empty counts as content
  check: eachApexFile(({ tokens }) => {
    const found: Array<{ token: Token; message: string }> = [];
    tokens.forEach((token, index) => {
      if (!isWord(token, 'catch') || !isPunct(tokens[index + 1], '(')) return;
      let close = index + 2;
      let depth = 1;
      for (; close < tokens.length && depth > 0; close++) {
        if (isPunct(tokens[close], '(')) depth++;
        if (isPunct(tokens[close], ')')) depth--;
      }
      if (isPunct(tokens[close], '{') && isPunct(tokens[close + 1], '}')) {
        found.push({ token, message: 'Empty catch block: log the error or rethrow it.' });
      }
    });
    return found;
  }),
};

export const systemDebug: Rule = {
  id: 'apex-system-debug',
  category: 'Apex',
  cost: 2,
  summary: 'System.debug left in the code: it costs CPU time even when nobody reads the logs.',
  check: eachApexFile(({ code }) =>
    code
      .filter(
        (token, index) => isWord(token, 'system') && isPunct(code[index + 1], '.') && isWord(code[index + 2], 'debug')
      )
      .map((token) => ({ token, message: 'System.debug left in the code.' }))
  ),
};

export const seeAllData: Rule = {
  id: 'apex-see-all-data',
  category: 'Tests',
  cost: 20,
  summary: 'Test with SeeAllData=true: it depends on the data of the org it runs in.',
  check: eachApexFile(({ code }) =>
    code
      .filter(
        (token, index) =>
          isWord(token, 'seealldata') && isPunct(code[index + 1], '=') && isWord(code[index + 2], 'true')
      )
      .map((token) => ({ token, message: 'SeeAllData=true: create the test data in the test.' }))
  ),
};

const TODO = /\b(TODO|FIXME|HACK|XXX)\b/;

export const todoComment: Rule = {
  id: 'apex-todo-comment',
  category: 'Apex',
  cost: 5,
  summary: 'TODO, FIXME, HACK or XXX comment: work that was left for later.',
  check: eachApexFile(({ tokens }) =>
    tokens.flatMap((token) => {
      if (token.kind !== 'comment') return [];
      const lines = token.text.split('\n');
      const offset = lines.findIndex((line) => TODO.test(line));
      if (offset === -1) return [];
      const marker = TODO.exec(lines[offset])?.[1] ?? 'TODO';
      return [
        {
          token: { ...token, line: token.line + offset },
          message: `${marker} comment: do it or remove it.`,
        },
      ];
    })
  ),
};
