import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

/** Replaceable in tests so generating a report never opens a real browser. */
export const browser = {
  async open(file: string): Promise<void> {
    const url = pathToFileURL(file).href;
    const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    await promisify(execFile)(command, args, { windowsHide: true });
  },
};
