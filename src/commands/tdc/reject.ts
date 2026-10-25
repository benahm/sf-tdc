import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { DebtError, readDeclaredDebts, toSfError, writeDeclaredDebt, type DeclaredDebt } from '../../debt/declared.js';
import { resolveIds } from '../../debt/work.js';
import { loadProject, toPosix } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.reject');

export type TdcRejectResult = {
  debt: DeclaredDebt;
  file: string;
};

export default class TdcReject extends SfCommand<TdcRejectResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    id: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.id.summary'),
      required: true,
    }),
    reason: Flags.string({
      char: 'm',
      summary: messages.getMessage('flags.reason.summary'),
      required: true,
    }),
  };

  public async run(): Promise<TdcRejectResult> {
    const { flags } = await this.parse(TdcReject);
    const project = await loadProject(process.cwd());
    const declared = await readDeclaredDebts(project);
    let debt: DeclaredDebt;
    try {
      const [id] = resolveIds(
        [flags.id],
        declared.map((item) => item.id)
      );
      debt = declared.find((item) => item.id === id)!;
      if (debt.status !== 'confirmed') {
        throw new DebtError('NOT_OPEN', `${id} is already ${debt.status}`, 'Only a confirmed debt can be rejected');
      }
    } catch (error) {
      throw toSfError(
        error instanceof DebtError && error.code === 'UNKNOWN_ID'
          ? new DebtError(
              'UNKNOWN_ID',
              `no declared debt has the id ${flags.id}`,
              'The debt of the rules is not rejected one by one: disable or reprice its rule in .tdc/config.json, or fix it'
            )
          : error
      );
    }
    debt = { ...debt, status: 'rejected', reason: flags.reason };
    const file = toPosix(path.relative(project.root, await writeDeclaredDebt(project, debt)));
    this.log(messages.getMessage('info.rejected', [debt.id, file]));
    return { debt, file };
  }
}
