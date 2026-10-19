import { emptyCatch, hardcodedId, seeAllData, systemDebug, todoComment } from './apex/code-smells.js';
import { dmlInLoop, soqlInLoop } from './apex/in-loop.js';
import { classWithoutTest, testWithoutAssert } from './apex/tests.js';
import { multipleTriggers } from './apex/triggers.js';
import {
  auraComponent,
  fieldWithoutDescription,
  flowMissingFaultPath,
  oldApiVersion,
  processBuilder,
  visualforcePage,
  workflowRule,
} from './metadata/metadata.js';
import type { Rule } from './rule.js';

export const RULES: Rule[] = [
  soqlInLoop,
  dmlInLoop,
  hardcodedId,
  emptyCatch,
  systemDebug,
  todoComment,
  multipleTriggers,
  seeAllData,
  testWithoutAssert,
  classWithoutTest,
  processBuilder,
  workflowRule,
  flowMissingFaultPath,
  auraComponent,
  visualforcePage,
  oldApiVersion,
  fieldWithoutDescription,
];

export const ruleById = (id: string): Rule | undefined => RULES.find((rule) => rule.id === id);
