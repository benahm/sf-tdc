import { isWord } from '../../apex/lexer.js';
import type { RawFinding, Rule } from '../rule.js';

export const multipleTriggers: Rule = {
  id: 'apex-multiple-triggers',
  category: 'Apex',
  cost: 60,
  summary: 'Several triggers on the same object: their order of execution is not guaranteed.',
  check: async (context) => {
    const byObject = new Map<string, RawFinding[]>();
    for (const { file, apex } of await context.apexFiles()) {
      if (!apex.isTrigger) continue;
      const { code } = apex;
      const index = code.findIndex((token, i) => isWord(token, 'trigger') && isWord(code[i + 2], 'on'));
      const object = code[index + 3];
      if (index === -1 || object?.kind !== 'word') continue;
      const findings = byObject.get(object.lower) ?? [];
      findings.push({
        file,
        line: code[index].line,
        snippet: `trigger ${code[index + 1].text} on ${object.text}`,
        message: `${object.text} has several triggers: merge them into one trigger and a handler class.`,
      });
      byObject.set(object.lower, findings);
    }
    // the first trigger of an object is legitimate: the others are the debt
    return [...byObject.values()].flatMap((findings) => findings.slice(1));
  },
};
