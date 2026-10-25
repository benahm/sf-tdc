import { existsSync } from 'node:fs';
import path from 'node:path';

import { CodeAnalyzer, CodeAnalyzerConfig, SeverityLevel } from '@salesforce/code-analyzer-core';
import * as EslintEngine from '@salesforce/code-analyzer-eslint-engine';
import * as FlowEngine from '@salesforce/code-analyzer-flow-engine';
import * as PmdEngine from '@salesforce/code-analyzer-pmd-engine';
import * as RegexEngine from '@salesforce/code-analyzer-regex-engine';

import type { SourceFile } from '../project/files.js';
import type { Project } from '../project/project.js';

export type Severity = keyof typeof SeverityLevel;

export type AnalyzerRule = {
  /** `engine:rule`, also a valid rule selector of code-analyzer. */
  id: string;
  severity: Severity;
  tags: string[];
  description: string;
};

export type AnalyzerViolation = {
  rule: string;
  file: string;
  line?: number;
  column?: number;
  message: string;
};

export type Analysis = {
  /** Version of code-analyzer and of each engine that ran: a new version can find other violations. */
  engines: Record<string, string>;
  /** Every selected rule, whether it found something or not. */
  rules: AnalyzerRule[];
  violations: AnalyzerViolation[];
};

export type Analyzer = (project: Project, files: SourceFile[]) => Promise<Analysis>;

const CONFIG_FILES = ['code-analyzer.yml', 'code-analyzer.yaml'];

/** The code-analyzer.yml of the project, so that its rule overrides and suppressions apply as with the sf plugin. */
const loadConfig = (root: string): CodeAnalyzerConfig => {
  const file = CONFIG_FILES.map((name) => path.join(root, name)).find((candidate) => existsSync(candidate));
  return file ? CodeAnalyzerConfig.fromFile(file) : CodeAnalyzerConfig.withDefaults();
};

/**
 * Runs the rules of Salesforce Code Analyzer: PMD and CPD (Java), Flow (Python), ESLint and regex. Its engines are
 * pinned by this plugin, so that every developer and the CI get the same violations from the same code.
 */
export const runCodeAnalyzer: Analyzer = async (project, files) => {
  const core = new CodeAnalyzer(loadConfig(project.root));
  for (const engine of [PmdEngine, RegexEngine, FlowEngine, EslintEngine]) {
    // eslint-disable-next-line no-await-in-loop
    await core.addEnginePlugin(engine.createEnginePlugin());
  }
  // selected without the workspace: the rules, and so the ledger, don't depend on the kinds of files of the project
  const selection = await core.selectRules(project.config.ruleSelectors);
  const rules = selection.getEngineNames().flatMap((engine) =>
    selection.getRulesFor(engine).map(
      (rule): AnalyzerRule => ({
        id: `${engine}:${rule.getName()}`,
        severity: SeverityLevel[rule.getSeverityLevel()] as Severity,
        tags: rule.getTags(),
        description: rule.getDescription(),
      })
    )
  );
  if (files.length === 0) return { engines: {}, rules, violations: [] };

  const workspace = await core.createWorkspace(
    project.sourceDirs.filter((dir) => existsSync(dir)),
    files.map((file) => file.path)
  );
  const results = await core.run(selection, { workspace });

  const engines: Record<string, string> = { core: results.getCoreVersion() };
  for (const engine of results.getEngineNames())
    engines[engine] = results.getEngineRunResults(engine).getEngineVersion();

  const violations: AnalyzerViolation[] = [];
  const failures: string[] = [];
  for (const violation of results.getViolations()) {
    const location = violation.getPrimaryLocation();
    const file = location.getFile();
    // an engine that could not run (no Java for PMD, no Python for Flow) reports a violation without a file
    if (file === undefined) {
      failures.push(violation.getMessage());
      continue;
    }
    violations.push({
      rule: `${violation.getRule().getEngineName()}:${violation.getRule().getName()}`,
      file,
      line: location.getStartLine(),
      column: location.getStartColumn(),
      message: violation.getMessage(),
    });
  }
  // a partial scan would pay all the debt of the engines that failed
  if (failures.length) throw new Error(`Code Analyzer could not run:\n${failures.join('\n')}`);
  return { engines, rules, violations };
};
