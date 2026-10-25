import type { Project } from '../project/project.js';
import { CATEGORIES, EXPOSURES, IMPACTS, SCOPES, type DebtInput } from './declared.js';

export type Guide = {
  workflows: Record<'fix' | 'declare', string[]>;
  rules: string[];
  declare: {
    example: DebtInput;
    categories: readonly string[];
    criticality: { exposure: readonly string[]; impact: readonly string[]; scope: readonly string[]; severity: string };
    costs: Record<string, number>;
    verifiers: Record<'pattern' | 'prompt', string>;
    promptVerifier: string;
  };
};

const EXAMPLE: DebtInput = {
  title: 'Flow updates accounts in system mode without checking access',
  description:
    'Lead_Assign runs without sharing and updates the Account of the lead: any user who can create a lead can change an account they cannot see.',
  category: 'Security',
  criticality: { exposure: 'user', impact: 'data-corruption', scope: 'record' },
  anchors: [
    {
      file: 'force-app/main/default/flows/Lead_Assign.flow-meta.xml',
      snippet: '<runInMode>SystemModeWithoutSharing</runInMode>',
    },
  ],
  verifier: {
    kind: 'pattern',
    file: 'force-app/main/default/flows/Lead_Assign.flow-meta.xml',
    pattern: '<runInMode>SystemModeWithoutSharing</runInMode>',
  },
};

/** How an agent works with sf-tdc: shipped with the plugin, so that it never drifts from the commands. */
export const buildGuide = (project: Project): Guide => ({
  workflows: {
    fix: [
      'sf tdc next --json: the debt to fix, most expensive first',
      'Fix one item, in its file and around its line',
      'sf tdc verify --id <id> --json: exit code 0 when it is paid and nothing was created or hidden; otherwise follow nextSteps',
      'sf tdc scan, then commit the fix with .tdc/ledger.json and .tdc/debts',
    ],
    declare: [
      'sf tdc next --source agent --json: the debt already declared, not to declare it twice',
      'Look for a problem that the rules do not find: logic, security, limits, design',
      'sf tdc add --json < debt.json: the debt is checked, then its verifier must find it on the current code to be confirmed',
      'Commit the file of .tdc/debts it wrote',
    ],
  },
  rules: [
    'Never hide debt: no NOPMD, @SuppressWarnings, eslint-disable, nor changes to .forceignore, code-analyzer.yml, sfdx-project.json or .tdc/config.json. sf tdc verify fails on them.',
    'Deleting a file is not paying its debt.',
    'Do not edit the verifier of a declared debt to make it pass: a person decides on a false positive (sf tdc reject).',
    'Prefer a pattern verifier: it is deterministic. Use a prompt only when no pattern can tell the fix.',
  ],
  declare: {
    example: EXAMPLE,
    categories: CATEGORIES,
    criticality: {
      exposure: EXPOSURES,
      impact: IMPACTS,
      scope: SCOPES,
      severity:
        'Computed: data-leak and data-corruption are High, limits Moderate, performance Low, maintainability Info; an anonymous exposure or a bulk scope raises it one level, an admin-only exposure lowers it one level.',
    },
    costs: project.config.severityCosts,
    verifiers: {
      pattern:
        'verifier.pattern is a JavaScript regular expression (multiline) that matches verifier.file while the debt is there.',
      prompt:
        'verifier.prompt is a question about the anchored files, answered "present", "fixed" or "unclear" with the code as evidence.',
    },
    promptVerifier: project.config.verifier
      ? `Answered by "${project.config.verifier.command}", ${project.config.verifier.runs} times: every answer must agree.`
      : 'Not configured: set verifier.command in .tdc/config.json to use prompt verifiers.',
  },
});

export const guideToMarkdown = (guide: Guide): string =>
  [
    '# Working with sf-tdc',
    '',
    '## Fix debt',
    ...guide.workflows.fix.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Declare debt that the rules do not find',
    ...guide.workflows.declare.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Rules',
    ...guide.rules.map((rule) => `- ${rule}`),
    '',
    '## A declared debt',
    '```json',
    JSON.stringify(guide.declare.example, null, 2),
    '```',
    `- category: ${guide.declare.categories.join(', ')}`,
    `- criticality.exposure: ${guide.declare.criticality.exposure.join(', ')}`,
    `- criticality.impact: ${guide.declare.criticality.impact.join(', ')}`,
    `- criticality.scope: ${guide.declare.criticality.scope.join(', ')}`,
    `- severity: ${guide.declare.criticality.severity}`,
    `- cost in TDC by severity: ${Object.entries(guide.declare.costs)
      .map(([severity, cost]) => `${severity} ${cost}`)
      .join(', ')}`,
    `- pattern verifier: ${guide.declare.verifiers.pattern}`,
    `- prompt verifier: ${guide.declare.verifiers.prompt} ${guide.declare.promptVerifier}`,
    '',
  ].join('\n');
