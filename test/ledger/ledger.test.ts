import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect } from 'chai';

import {
  compareLedgers,
  parseLedger,
  serializeLedger,
  type Ledger,
  type LedgerFinding,
} from '../../src/ledger/ledger.js';
import { loadProject } from '../../src/project/project.js';
import { scan, toLedger } from '../../src/scan/engine.js';
import { createProject, removeProject, useFakeAnalyzer, writeSources } from '../helpers.js';

const finding = (id: string, overrides: Partial<LedgerFinding> = {}): LedgerFinding => ({
  id,
  rule: 'pmd:AvoidDebugStatements',
  file: 'force-app/main/default/classes/A.cls',
  cost: 5,
  hash: `hash-${id}`,
  snippet: `System.debug('${id}');`,
  ...overrides,
});

const ledger = (...findings: LedgerFinding[]): Ledger => ({
  version: 2,
  engines: { core: '1.0.0', pmd: '1.0.0' },
  rules: { 'pmd:AvoidDebugStatements': 5 },
  findings,
});

describe('ledger', () => {
  useFakeAnalyzer();

  it('serializes one finding per line, sorted, and parses back', () => {
    const content = serializeLedger(ledger(finding('b'), finding('a')));
    expect(content.split('\n').filter((line) => line.includes('"id"'))).to.have.length(2);
    expect(content.indexOf('"id":"a"')).to.be.lessThan(content.indexOf('"id":"b"'));
    expect(parseLedger(content).findings.map((item) => item.id)).to.deep.equal(['a', 'b']);
  });

  it('tells paid, created, moved and deleted debt apart', () => {
    const before = ledger(
      finding('paid'),
      finding('kept'),
      finding('moved', { hash: 'same' }),
      finding('gone', { file: 'force-app/main/default/classes/Deleted.cls' })
    );
    const after = ledger(
      finding('kept'),
      finding('moved-to', { hash: 'same', file: 'force-app/main/default/classes/B.cls' }),
      finding('new')
    );
    const changes = compareLedgers(before, after, new Set(['force-app/main/default/classes/Deleted.cls']));
    expect(changes.paid.map((item) => item.id)).to.deep.equal(['paid']);
    expect(changes.deleted.map((item) => item.id)).to.deep.equal(['gone']);
    expect(changes.created.map((item) => item.id)).to.deep.equal(['new']);
    expect(changes.moved).to.equal(1);
  });

  describe('fingerprints', () => {
    let root: string;
    const source = (lines: string): Record<string, string> => ({
      'classes/A.cls': `public class A {\n${lines}\n  void a() { System.debug('x'); }\n}`,
    });
    const ids = async (): Promise<string[]> =>
      toLedger(await scan(await loadProject(root))).findings.map((item) => item.id);

    beforeEach(async () => {
      root = await createProject(source(''));
    });
    afterEach(() => removeProject(root));

    it('do not depend on line numbers', async () => {
      const before = await ids();
      await writeSources(root, source('\n\n  // new lines above\n'));
      expect(await ids()).to.deep.equal(before);
    });

    it('tell identical findings of a file apart by their order', async () => {
      await writeFile(
        path.join(root, 'force-app/main/default/classes/B.cls'),
        "public class B {\n  void a() { System.debug('x'); }\n  void b() { System.debug('x'); }\n}"
      );
      const all = await ids();
      expect(new Set(all).size).to.equal(all.length);
    });
  });
});
