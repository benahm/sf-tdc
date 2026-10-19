import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const git = async (cwd: string, args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
};

/** Root of the git repository containing `cwd`, or undefined outside of a repository. */
export const gitRoot = async (cwd: string): Promise<string | undefined> => {
  try {
    return (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    return undefined;
  }
};

/** Content of a file at a git ref, or undefined when the file doesn't exist there. */
export const showFile = async (cwd: string, ref: string, gitPath: string): Promise<string | undefined> => {
  try {
    return await git(cwd, ['show', `${ref}:${gitPath}`]);
  } catch {
    return undefined;
  }
};

export const userEmail = async (cwd: string): Promise<string | undefined> => {
  try {
    return (await git(cwd, ['config', 'user.email'])).trim() || undefined;
  } catch {
    return undefined;
  }
};
