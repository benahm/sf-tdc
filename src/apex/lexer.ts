export type TokenKind = 'word' | 'string' | 'comment' | 'punct';

export type Token = {
  kind: TokenKind;
  /** Source text; for a string, its content without the quotes. */
  text: string;
  /** Lower-cased text: Apex is case-insensitive. */
  lower: string;
  line: number;
};

const WORD = /[A-Za-z0-9_$]/;
const SPACE = /\s/;

const countNewlines = (text: string): number => text.split('\n').length - 1;

/**
 * Splits Apex source into words, strings, comments and punctuation. It is not a parser: it is enough to find loops,
 * blocks and statements without being fooled by comments or string contents.
 */
export const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  const push = (kind: TokenKind, text: string, line: number): void => {
    tokens.push({ kind, text, lower: text.toLowerCase(), line });
  };
  let line = 1;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '\n') {
      line++;
      i++;
    } else if (SPACE.test(char)) {
      i++;
    } else if (char === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      push('comment', source.slice(i, stop), line);
      i = stop;
    } else if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      const text = source.slice(i, stop);
      push('comment', text, line);
      line += countNewlines(text);
      i = stop;
    } else if (char === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== "'" && source[j] !== '\n') {
        j += source[j] === '\\' ? 2 : 1;
      }
      push('string', source.slice(i + 1, j), line);
      i = j + 1;
    } else if (WORD.test(char)) {
      let j = i + 1;
      while (j < source.length && WORD.test(source[j])) j++;
      push('word', source.slice(i, j), line);
      i = j;
    } else {
      push('punct', char, line);
      i++;
    }
  }
  return tokens;
};

const PAIRS: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
const CLOSERS = new Set(Object.values(PAIRS));

/** Index of the matching bracket for every bracket token. Unbalanced brackets are left out. */
export const matchBrackets = (tokens: Token[]): Map<number, number> => {
  const matches = new Map<number, number>();
  const stack: number[] = [];
  tokens.forEach((token, index) => {
    if (token.kind !== 'punct') return;
    if (PAIRS[token.text]) {
      stack.push(index);
    } else if (CLOSERS.has(token.text)) {
      const open = stack.pop();
      if (open !== undefined && PAIRS[tokens[open].text] === token.text) {
        matches.set(open, index);
        matches.set(index, open);
      }
    }
  });
  return matches;
};

export const isPunct = (token: Token | undefined, text: string): boolean =>
  token?.kind === 'punct' && token.text === text;

export const isWord = (token: Token | undefined, ...words: string[]): boolean =>
  token?.kind === 'word' && words.includes(token.lower);
