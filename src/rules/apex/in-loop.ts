import { isPunct, isWord, type Token } from '../../apex/lexer.js';
import type { Rule } from '../rule.js';
import { eachApexFile } from './apex-rule.js';

const DML_KEYWORDS = ['insert', 'update', 'upsert', 'delete', 'undelete', 'merge'];
const DATABASE_QUERIES = ['query', 'querywithbinds', 'countquery', 'countquerywithbinds'];

export const soqlInLoop: Rule = {
  id: 'apex-soql-in-loop',
  category: 'Apex',
  cost: 30,
  summary: 'SOQL or SOSL query inside a loop: it hits the governor limit of 100 queries.',
  check: eachApexFile(({ code, loopDepth }) =>
    code.flatMap((token, index) => {
      if (loopDepth[index] === 0) return [];
      const inline = isPunct(token, '[') && isWord(code[index + 1], 'select', 'find');
      const dynamic =
        (isWord(token, 'database') || isWord(token, 'search')) &&
        isPunct(code[index + 1], '.') &&
        isWord(code[index + 2], ...DATABASE_QUERIES) &&
        isPunct(code[index + 3], '(');
      return inline || dynamic ? [{ token, message: 'Query inside a loop: query once before the loop.' }] : [];
    })
  ),
};

/** `update records;`: the keyword starts a statement and is followed by its operand. */
const isDmlStatement = (index: number, code: Token[]): boolean => {
  const previous = code[index - 1];
  const next = code[index + 1];
  const startsStatement =
    previous === undefined || ['{', '}', ';', ')'].some((text) => isPunct(previous, text)) || isWord(previous, 'else');
  return startsStatement && (next?.kind === 'word' || isPunct(next, '['));
};

export const dmlInLoop: Rule = {
  id: 'apex-dml-in-loop',
  category: 'Apex',
  cost: 30,
  summary: 'DML inside a loop: it hits the governor limit of 150 DML statements.',
  check: eachApexFile(({ code, loopDepth }) =>
    code.flatMap((token, index) => {
      if (loopDepth[index] === 0) return [];
      const statement = isWord(token, ...DML_KEYWORDS) && isDmlStatement(index, code);
      const database =
        isWord(token, 'database') &&
        isPunct(code[index + 1], '.') &&
        isWord(code[index + 2], ...DML_KEYWORDS) &&
        isPunct(code[index + 3], '(');
      return statement || database
        ? [
            {
              token,
              message: 'DML inside a loop: collect the records and run the DML once after the loop.',
            },
          ]
        : [];
    })
  ),
};
