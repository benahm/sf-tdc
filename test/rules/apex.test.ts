import { expect } from 'chai';

import { findingsOf } from '../helpers.js';

const cls = (name: string, body: string): Record<string, string> => ({
  [`classes/${name}.cls`]: body,
});

describe('Apex rules', () => {
  describe('apex-soql-in-loop', () => {
    it('finds inline and dynamic queries inside for, while and do loops', async () => {
      const findings = await findingsOf(
        cls(
          'AccountService',
          `public class AccountService {
  public void run(List<Id> ids) {
    for (Id id : ids) {
      Account a = [SELECT Id FROM Account WHERE Id = :id];
    }
    while (true) {
      List<SObject> rows = Database.query('SELECT Id FROM Contact');
    }
    do {
      Integer n = [select count() from Lead];
    } while (false);
  }
}`
        ),
        'apex-soql-in-loop'
      );
      expect(findings.map((finding) => finding.line)).to.deep.equal([4, 7, 10]);
    });

    it('ignores the query of a SOQL for loop, a query after a loop and a query in a comment', async () => {
      const findings = await findingsOf(
        cls(
          'AccountService',
          `public class AccountService {
  public void run() {
    for (Account a : [SELECT Id FROM Account]) {
      // [SELECT Id FROM Contact]
      a.Name = 'x';
    }
    List<Contact> contacts = [SELECT Id FROM Contact];
  }
}`
        ),
        'apex-soql-in-loop'
      );
      expect(findings).to.deep.equal([]);
    });

    it('finds a query in the body of a loop without braces', async () => {
      const findings = await findingsOf(
        cls(
          'AccountService',
          `public class AccountService {
  public void run(List<Id> ids) {
    for (Id id : ids) System.debug([SELECT Id FROM Account WHERE Id = :id]);
    Account after = [SELECT Id FROM Account LIMIT 1];
  }
}`
        ),
        'apex-soql-in-loop'
      );
      expect(findings.map((finding) => finding.line)).to.deep.equal([3]);
    });
  });

  describe('apex-dml-in-loop', () => {
    it('finds DML statements and Database methods inside loops', async () => {
      const findings = await findingsOf(
        cls(
          'AccountService',
          `public class AccountService {
  public void run(List<Account> accounts) {
    for (Account a : accounts) {
      update a;
      Database.insert(new Contact(), false);
    }
    update accounts;
  }
  public void update(Account a) {}
}`
        ),
        'apex-dml-in-loop'
      );
      expect(findings.map((finding) => finding.line)).to.deep.equal([4, 5]);
    });
  });

  it('apex-hardcoded-id finds 15 and 18 character IDs in strings only', async () => {
    const findings = await findingsOf(
      cls(
        'Ids',
        `public class Ids {
  Id a = '001D000000IqhSL';
  Id b = '001D000000IqhSLIAZ';
  String name = 'AccountService';
}`
      ),
      'apex-hardcoded-id'
    );
    expect(findings.map((finding) => finding.line)).to.deep.equal([2, 3]);
  });

  it('apex-empty-catch accepts a catch that explains itself in a comment', async () => {
    const findings = await findingsOf(
      cls(
        'Catches',
        `public class Catches {
  void a() { try { x(); } catch (Exception e) {} }
  void b() { try { x(); } catch (Exception e) { /* expected when offline */ } }
  void c() { try { x(); } catch (Exception e) { log(e); } }
}`
      ),
      'apex-empty-catch'
    );
    expect(findings.map((finding) => finding.line)).to.deep.equal([2]);
  });

  it('apex-system-debug and apex-todo-comment find each occurrence', async () => {
    const files = cls(
      'Debugs',
      `public class Debugs {
  void a() {
    System.debug('a'); // TODO remove
    system.DEBUG('b');
  }
  /*
   * FIXME: slow
   */
}`
    );
    expect((await findingsOf(files, 'apex-system-debug')).map((finding) => finding.line)).to.deep.equal([3, 4]);
    expect((await findingsOf(files, 'apex-todo-comment')).map((finding) => finding.line)).to.deep.equal([3, 7]);
  });

  describe('tests', () => {
    const service = cls('AccountService', 'public class AccountService { public void run() {} }');

    it('apex-test-without-assert finds the test methods that assert nothing', async () => {
      const findings = await findingsOf(
        {
          ...service,
          ...cls(
            'AccountServiceTest',
            `@IsTest
private class AccountServiceTest {
  @TestSetup static void setup() {}
  @IsTest static void covers() { new AccountService().run(); }
  @IsTest(SeeAllData=true) static void checks() { Assert.areEqual(1, 1); }
  static testMethod void legacy() { System.assertEquals(1, 1); }
  static testMethod void legacyEmpty() { new AccountService().run(); }
}`
          ),
        },
        'apex-test-without-assert'
      );
      expect(findings.map((finding) => finding.message)).to.deep.equal([
        'Test covers asserts nothing.',
        'Test legacyEmpty asserts nothing.',
      ]);
    });

    it('apex-see-all-data finds SeeAllData=true', async () => {
      const findings = await findingsOf(
        cls(
          'OldTest',
          '@IsTest(SeeAllData=true)\nprivate class OldTest { @IsTest static void t() { Assert.isTrue(true); } }'
        ),
        'apex-see-all-data'
      );
      expect(findings).to.have.length(1);
    });

    it('apex-class-without-test finds the classes no test nor trigger mentions, but not exceptions nor interfaces', async () => {
      const findings = await findingsOf(
        {
          ...service,
          ...cls('Orphan', 'public with sharing class Orphan {}'),
          ...cls('MyException', 'public class MyException extends Exception {}'),
          ...cls('Shape', 'public interface Shape {}'),
          ...cls('InvoiceTriggerHandler', 'public class InvoiceTriggerHandler { public void run() {} }'),
          'triggers/InvoiceTrigger.trigger':
            'trigger InvoiceTrigger on Invoice__c (before insert) { new InvoiceTriggerHandler().run(); }',
          ...cls(
            'AccountServiceTest',
            '@IsTest private class AccountServiceTest { @IsTest static void t() { new AccountService(); Assert.isTrue(true); } }'
          ),
        },
        'apex-class-without-test'
      );
      expect(findings.map((finding) => finding.snippet)).to.deep.equal(['class Orphan']);
    });
  });

  it('apex-multiple-triggers flags every trigger of an object but the first', async () => {
    const findings = await findingsOf(
      {
        'triggers/AccountTrigger.trigger': 'trigger AccountTrigger on Account (before insert) {}',
        'triggers/AccountTrigger2.trigger': 'trigger AccountTrigger2 on Account (after update) {}',
        'triggers/ContactTrigger.trigger': 'trigger ContactTrigger on Contact (before insert) {}',
      },
      'apex-multiple-triggers'
    );
    expect(findings.map((finding) => finding.file)).to.deep.equal([
      'force-app/main/default/triggers/AccountTrigger2.trigger',
    ]);
  });
});
