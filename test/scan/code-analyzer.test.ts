import { expect } from 'chai';

import { loadProject } from '../../src/project/project.js';
import { scan, toLedger, type ScanResult } from '../../src/scan/engine.js';
import { createProject, removeProject, writeSources } from '../helpers.js';

const SERVICE = (header = ''): string => `public with sharing class AccountService {${header}
    public static void run(List<Account> accounts) {
        for (Account a : accounts) {
            Contact c = [SELECT Id FROM Contact WHERE AccountId = :a.Id WITH USER_MODE LIMIT 1];
        }
    }
}`;

const OLD_META = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>40.0</apiVersion>
    <status>Active</status>
</ApexClass>`;

const FLOW = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>62.0</apiVersion>
    <label>Lead Assign</label>
    <processType>AutoLaunchedFlow</processType>
    <status>Active</status>
    <variables>
        <name>leads</name>
        <dataType>SObject</dataType>
        <isCollection>true</isCollection>
        <isInput>true</isInput>
        <isOutput>false</isOutput>
        <objectType>Lead</objectType>
    </variables>
    <loops>
        <name>Each_Lead</name>
        <label>Each Lead</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <collectionReference>leads</collectionReference>
        <iterationOrder>Asc</iterationOrder>
        <nextValueConnector><targetReference>Update_Lead</targetReference></nextValueConnector>
    </loops>
    <recordUpdates>
        <name>Update_Lead</name>
        <label>Update Lead</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector><targetReference>Each_Lead</targetReference></connector>
        <inputReference>Each_Lead</inputReference>
    </recordUpdates>
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector><targetReference>Each_Lead</targetReference></connector>
    </start>
</Flow>`;

// runs the real code-analyzer: Java for PMD, Python for Flow
describe('code-analyzer', () => {
  let root: string;
  let result: ScanResult;
  const finding = (rule: string): ScanResult['findings'][number] | undefined =>
    result.findings.find((item) => item.rule === rule);

  before(async () => {
    root = await createProject({
      'classes/AccountService.cls': SERVICE(),
      'classes/AccountService.cls-meta.xml': OLD_META,
      'flows/Lead_Assign.flow-meta.xml': FLOW,
    });
    result = await scan(await loadProject(root));
  });
  after(() => removeProject(root));

  it('prices the violations of the recommended rules by severity', () => {
    expect(finding('pmd:OperationWithLimitsInLoop')).to.deep.include({
      file: 'force-app/main/default/classes/AccountService.cls',
      line: 4,
      cost: 15,
      category: 'Performance',
    });
    expect(finding('flow:DbInLoop')).to.deep.include({ cost: 30 });
    expect(finding('regex:AvoidOldSalesforceApiVersions')).to.deep.include({
      cost: 30,
      snippet: '<apiVersion>40.0</apiVersion>',
    });
  });

  it('records every selected rule and the versions of the engines', () => {
    expect(Object.keys(result.rules).length).to.be.greaterThan(100);
    expect(result.engines).to.include.keys('core', 'pmd', 'flow', 'regex');
  });

  it('identifies the findings without their line numbers', async () => {
    await writeSources(root, { 'classes/AccountService.cls': SERVICE('\n\n    // new lines above\n') });
    const ids = (scanned: ScanResult): string[] =>
      toLedger(scanned)
        .findings.map((item) => item.id)
        .sort();
    expect(ids(await scan(await loadProject(root)))).to.deep.equal(ids(result));
  });
});
