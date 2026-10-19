import path from 'node:path';

import { XMLParser } from 'fast-xml-parser';

import type { SourceFile } from '../../project/files.js';
import { filesEndingWith, readFilesEndingWith, type RawFinding, type Rule, type ScanContext } from '../rule.js';

const xml = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const componentName = (file: SourceFile): string => path.basename(file.relPath).replace(/\..*$/, '');

const lineOf = (content: string, text: string): number | undefined => {
  const index = content.indexOf(text);
  return index === -1 ? undefined : content.slice(0, index).split('\n').length;
};

const API_VERSION = /<apiVersion>\s*(\d+(?:\.\d+)?)\s*<\/apiVersion>/;

export const oldApiVersion: Rule = {
  id: 'metadata-old-api-version',
  category: 'Metadata',
  cost: 10,
  summary: 'Component saved with an old API version: it misses platform fixes and gets retired.',
  check: async (context) =>
    (await readFilesEndingWith(context, '-meta.xml')).flatMap(({ file, content }): RawFinding[] => {
      const match = API_VERSION.exec(content);
      if (!match || Number(match[1]) >= context.minApiVersion) return [];
      return [
        {
          file,
          line: lineOf(content, match[0]),
          // without the version: moving from one old version to another neither pays nor creates debt
          snippet: 'apiVersion',
          message: `API version ${match[1]} is older than ${context.minApiVersion}.0.`,
        },
      ];
    }),
};

type FlowXml = { Flow?: Record<string, unknown> & { processType?: string } };

type ParsedFlow = { file: SourceFile; content: string; flow: NonNullable<FlowXml['Flow']> };

/** Flows are parsed once per scan: two rules read them. */
const parsedFlows = new WeakMap<ScanContext, Promise<ParsedFlow[]>>();

const flows = (context: ScanContext): Promise<ParsedFlow[]> => {
  let parsed = parsedFlows.get(context);
  if (!parsed) {
    parsed = readFilesEndingWith(context, '.flow-meta.xml').then((files) =>
      files.flatMap(({ file, content }) => {
        const flow = (xml.parse(content) as FlowXml).Flow;
        return flow ? [{ file, content, flow }] : [];
      })
    );
    parsedFlows.set(context, parsed);
  }
  return parsed;
};

const PROCESS_BUILDER_TYPES = new Set(['Workflow', 'CustomEvent', 'InvocableProcess']);

export const processBuilder: Rule = {
  id: 'flow-process-builder',
  category: 'Automation',
  cost: 240,
  summary: 'Process Builder: retired by Salesforce, to migrate to a record-triggered flow.',
  check: async (context) =>
    (await flows(context))
      .filter(({ flow }) => PROCESS_BUILDER_TYPES.has(flow.processType ?? ''))
      .map(({ file, content }) => ({
        file,
        line: lineOf(content, '<processType>'),
        snippet: 'processType',
        message: `Process Builder ${componentName(file)}: migrate it to a record-triggered flow.`,
      })),
};

const FAULTABLE_ELEMENTS = ['recordCreates', 'recordUpdates', 'recordDeletes', 'recordLookups', 'actionCalls'];

export const flowMissingFaultPath: Rule = {
  id: 'flow-missing-fault-path',
  category: 'Automation',
  cost: 15,
  summary: 'Flow element that can fail without a fault path: the user gets an unhandled error.',
  check: async (context) =>
    (await flows(context))
      .filter(({ flow }) => !PROCESS_BUILDER_TYPES.has(flow.processType ?? ''))
      .flatMap(({ file, content, flow }) =>
        FAULTABLE_ELEMENTS.flatMap((type) =>
          asArray(flow[type] as Array<{ name?: string; faultConnector?: unknown }> | undefined)
            .filter((element) => element.faultConnector === undefined)
            .flatMap(({ name }) => (name ? [name] : []))
            .map((name) => ({
              file,
              line: lineOf(content, `<name>${name}</name>`),
              snippet: `${type}:${name}`,
              message: `${name} has no fault path.`,
            }))
        )
      ),
};

export const workflowRule: Rule = {
  id: 'automation-workflow-rule',
  category: 'Automation',
  cost: 120,
  summary: 'Workflow rule: retired by Salesforce, to migrate to a record-triggered flow.',
  check: async (context) =>
    (await readFilesEndingWith(context, '.workflow-meta.xml')).flatMap(({ file, content }) => {
      const workflow = (xml.parse(content) as { Workflow?: { rules?: Array<{ fullName?: string }> } }).Workflow;
      return asArray(workflow?.rules)
        .flatMap(({ fullName }) => (fullName ? [fullName] : []))
        .map((fullName) => ({
          file,
          line: lineOf(content, `<fullName>${fullName}</fullName>`),
          snippet: `rule:${fullName}`,
          message: `Workflow rule ${fullName}: migrate it to a record-triggered flow.`,
        }));
    }),
};

const AURA_COMPONENT = /(^|\/)aura\/[^/]+\/[^/]+\.cmp$/;

export const auraComponent: Rule = {
  id: 'ui-aura-component',
  category: 'UI',
  cost: 480,
  summary: 'Aura component: to rewrite as a Lightning Web Component.',
  check: (context) =>
    Promise.resolve(
      context.files
        .filter((file) => AURA_COMPONENT.test(file.relPath))
        .map((file) => ({
          file,
          snippet: 'aura',
          message: `Aura component ${componentName(file)}: rewrite it as a Lightning Web Component.`,
        }))
    ),
};

export const visualforcePage: Rule = {
  id: 'ui-visualforce-page',
  category: 'UI',
  cost: 240,
  summary: 'Visualforce page: to rewrite with Lightning Web Components.',
  check: (context) =>
    Promise.resolve(
      filesEndingWith(context, '.page').map((file) => ({
        file,
        snippet: 'page',
        message: `Visualforce page ${componentName(file)}: rewrite it with Lightning Web Components.`,
      }))
    ),
};

export const fieldWithoutDescription: Rule = {
  id: 'metadata-field-without-description',
  category: 'Metadata',
  cost: 5,
  summary: 'Custom field without a description: nobody knows what it is for.',
  check: async (context) =>
    (await readFilesEndingWith(context, '.field-meta.xml')).flatMap(({ file, content }): RawFinding[] => {
      const name = componentName(file);
      // custom fields of the project only: a managed package field (ns__Field__c) has two "__"
      if (!name.endsWith('__c') || name.split('__').length !== 2) return [];
      const field = (xml.parse(content) as { CustomField?: { description?: string } }).CustomField;
      return field && !field.description?.trim()
        ? [{ file, snippet: 'description', message: `${name} has no description.` }]
        : [];
    }),
};
