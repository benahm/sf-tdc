import { expect } from 'chai';

import { findingsOf } from '../helpers.js';

const meta = (type: string, apiVersion: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<${type} xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>${apiVersion}</apiVersion>\n    <status>Active</status>\n</${type}>\n`;

const flow = (processType: string, elements: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>62.0</apiVersion>
${elements}
    <processType>${processType}</processType>
</Flow>
`;

describe('metadata rules', () => {
  it('metadata-old-api-version finds metadata 9 versions or more behind sourceApiVersion', async () => {
    const findings = await findingsOf(
      {
        'classes/Old.cls-meta.xml': meta('ApexClass', '45.0'),
        'classes/Limit.cls-meta.xml': meta('ApexClass', '53.0'),
        'classes/Recent.cls-meta.xml': meta('ApexClass', '62.0'),
      },
      'metadata-old-api-version'
    );
    expect(findings.map((finding) => [finding.file.split('/').pop(), finding.line, finding.message])).to.deep.equal([
      ['Old.cls-meta.xml', 3, 'API version 45.0 is older than 53.0.'],
    ]);
  });

  it('flow-process-builder finds Process Builders, and flow-missing-fault-path the elements without fault path', async () => {
    const files = {
      'flows/Lead_Assign.flow-meta.xml': flow(
        'Workflow',
        '    <recordUpdates><name>Update_Lead</name></recordUpdates>'
      ),
      'flows/Create_Case.flow-meta.xml': flow(
        'AutoLaunchedFlow',
        `    <recordCreates><name>Create_Case</name></recordCreates>
    <recordLookups><name>Get_Account</name><faultConnector><targetReference>Log</targetReference></faultConnector></recordLookups>`
      ),
    };
    expect((await findingsOf(files, 'flow-process-builder')).map((finding) => finding.message)).to.deep.equal([
      'Process Builder Lead_Assign: migrate it to a record-triggered flow.',
    ]);
    expect((await findingsOf(files, 'flow-missing-fault-path')).map((finding) => finding.snippet)).to.deep.equal([
      'recordCreates:Create_Case',
    ]);
  });

  it('automation-workflow-rule finds every rule of a workflow', async () => {
    const findings = await findingsOf(
      {
        'workflows/Account.workflow-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
    <rules><fullName>Notify_Owner</fullName><active>true</active></rules>
    <rules><fullName>Set_Rating</fullName><active>false</active></rules>
</Workflow>
`,
      },
      'automation-workflow-rule'
    );
    expect(findings.map((finding) => [finding.snippet, finding.line])).to.deep.equal([
      ['rule:Notify_Owner', 3],
      ['rule:Set_Rating', 4],
    ]);
  });

  it('ui-aura-component and ui-visualforce-page find one finding per component', async () => {
    const files = {
      'aura/accountCard/accountCard.cmp': '<aura:component></aura:component>',
      'aura/accountCard/accountCardController.js': '({})',
      'pages/Invoice.page': '<apex:page></apex:page>',
    };
    expect(await findingsOf(files, 'ui-aura-component')).to.have.length(1);
    expect(await findingsOf(files, 'ui-visualforce-page')).to.have.length(1);
  });

  it('metadata-field-without-description ignores standard and managed package fields', async () => {
    const field = (description: string): string =>
      `<?xml version="1.0" encoding="UTF-8"?>\n<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">\n${description}    <label>X</label>\n</CustomField>\n`;
    const findings = await findingsOf(
      {
        'objects/Account/fields/Score__c.field-meta.xml': field(''),
        'objects/Account/fields/Tier__c.field-meta.xml': field('    <description>Customer tier</description>\n'),
        'objects/Account/fields/ns__Managed__c.field-meta.xml': field(''),
        'objects/Account/fields/Industry.field-meta.xml': field(''),
      },
      'metadata-field-without-description'
    );
    expect(findings.map((finding) => finding.message)).to.deep.equal(['Score__c has no description.']);
  });
});
