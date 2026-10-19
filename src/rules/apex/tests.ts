import { isPunct, isWord, type Token } from '../../apex/lexer.js';
import type { RawFinding, Rule } from '../rule.js';
import { eachApexFile } from './apex-rule.js';

type TestMethod = { name: Token; body: Token[] };

/** Methods annotated with @IsTest, or declared with the `testMethod` modifier. */
const testMethods = (code: Token[], matches: Map<number, number>): TestMethod[] => {
  const methods: TestMethod[] = [];
  code.forEach((token, index) => {
    let start: number;
    if (isPunct(token, '@') && isWord(code[index + 1], 'istest')) {
      start = index + 2;
      if (isPunct(code[start], '(')) start = (matches.get(start) ?? start) + 1;
    } else if (isWord(token, 'testmethod')) {
      start = index + 1;
    } else {
      return;
    }
    let open = start;
    while (open < code.length && !isPunct(code[open], '{') && !isPunct(code[open], ';')) {
      // an annotated class or a field is not a method
      if (isWord(code[open], 'class', 'interface', 'enum') || isPunct(code[open], '=')) return;
      open++;
    }
    const close = matches.get(open);
    const paren = code.slice(start, open).findIndex((item) => isPunct(item, '('));
    if (!isPunct(code[open], '{') || close === undefined || paren < 1) return;
    methods.push({ name: code[start + paren - 1], body: code.slice(open + 1, close) });
  });
  return methods;
};

const asserts = (body: Token[]): boolean =>
  body.some((token) => token.kind === 'word' && (token.lower.startsWith('assert') || token.lower === 'verify'));

export const testWithoutAssert: Rule = {
  id: 'apex-test-without-assert',
  category: 'Tests',
  cost: 15,
  summary: 'Test method without assertion: it only raises the coverage, it checks nothing.',
  check: eachApexFile(({ code, matches, isTest }) =>
    isTest
      ? testMethods(code, matches)
          .filter((method) => !asserts(method.body))
          .map((method) => ({
            token: method.name,
            message: `Test ${method.name.text} asserts nothing.`,
          }))
      : []
  ),
};

/** First type declared in the file: its kind, name and what it extends. */
const mainType = (code: Token[]): { kind: string; name: Token; parent?: string } | undefined => {
  const index = code.findIndex((token) => isWord(token, 'class', 'interface', 'enum'));
  if (index === -1 || code[index + 1]?.kind !== 'word') return undefined;
  const parent = isWord(code[index + 2], 'extends') ? code[index + 3]?.lower : undefined;
  return { kind: code[index].lower, name: code[index + 1], parent };
};

export const classWithoutTest: Rule = {
  id: 'apex-class-without-test',
  category: 'Tests',
  cost: 60,
  summary: 'Class that neither a test class nor a trigger mentions: it is probably not tested.',
  check: async (context) => {
    const files = await context.apexFiles();
    // a trigger handler is tested through the DML of the tests, without them naming it
    const mentioned = new Set(
      files
        .filter(({ apex }) => apex.isTest || apex.isTrigger)
        .flatMap(({ apex }) => apex.code.map((token) => token.lower))
    );
    return files.flatMap(({ file, apex }): RawFinding[] => {
      if (apex.isTrigger || apex.isTest) return [];
      const type = mainType(apex.code);
      if (type?.kind !== 'class' || type.parent === 'exception' || mentioned.has(type.name.lower)) return [];
      return [
        {
          file,
          line: type.name.line,
          snippet: `class ${type.name.text}`,
          message: `No test class mentions ${type.name.text}.`,
        },
      ];
    });
  },
};
