import * as fsapi from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IS_WINDOWS } from '../../../common/platform/constants';
import { IFileSystem } from '../../../common/platform/types';
import { InterpreterType, PythonInterpreter } from '../../info';

const CheckPythonInterpreterRegEx = IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

// tslint:disable-next-line:no-suspicious-comment
// TODO: Switch back to using IFileSystem.
// https://github.com/microsoft/vscode-python/issues/11338
export async function lookForInterpretersInDirectory(pathToCheck: string, _: IFileSystem): Promise<string[]> {
    // Technically, we should be able to use fs.getFiles().  However,
    // that breaks some tests.  So we stick with the broader behavior.
    try {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO https://github.com/microsoft/vscode-python/issues/11338
        const files = await fsapi.readdir(pathToCheck);
        return files
            .map((filename) => path.join(pathToCheck, filename))
            .filter((fileName) => CheckPythonInterpreterRegEx.test(path.basename(fileName)));
    } catch (err) {
        traceError('Python Extension (lookForInterpretersInDirectory.fs.listdir):', err);
        return [] as string[];
    }
}

export class InterpreterLocatorHelper {
    constructor(
        private readonly deps: {
            normalizePath(p: string): string;
            getPathDirname(p: string): string;
            arePathsSame(p1: string, p2: string): boolean;
            getPipEnvInfo(p: string): Promise<{ workspaceFolder: Uri; envName: string } | undefined>;
        }
    ) {}
    public async mergeInterpreters(interpreters: PythonInterpreter[]): Promise<PythonInterpreter[]> {
        const deps = this.deps;
        const items = interpreters
            .map((item) => {
                return { ...item };
            })
            .map((item) => {
                item.path = deps.normalizePath(item.path);
                return item;
            })
            .reduce<PythonInterpreter[]>((accumulator, current) => {
                const currentVersion = current && current.version ? current.version.raw : undefined;
                const existingItem = accumulator.find((item) => {
                    // If same version and same base path, then ignore.
                    // Could be Python 3.6 with path = python.exe, and Python 3.6 and path = python3.exe.
                    if (
                        item.version &&
                        item.version.raw === currentVersion &&
                        item.path &&
                        current.path &&
                        deps.arePathsSame(deps.getPathDirname(item.path), deps.getPathDirname(current.path))
                    ) {
                        return true;
                    }
                    return false;
                });
                if (!existingItem) {
                    accumulator.push(current);
                } else {
                    // Preserve type information.
                    // Possible we identified environment as unknown, but a later provider has identified env type.
                    if (existingItem.type === InterpreterType.Unknown && current.type !== InterpreterType.Unknown) {
                        existingItem.type = current.type;
                    }
                    const props: (keyof PythonInterpreter)[] = [
                        'envName',
                        'envPath',
                        'path',
                        'sysPrefix',
                        'architecture',
                        'sysVersion',
                        'version'
                    ];
                    for (const prop of props) {
                        if (!existingItem[prop] && current[prop]) {
                            // tslint:disable-next-line: no-any
                            (existingItem as any)[prop] = current[prop];
                        }
                    }
                }
                return accumulator;
            }, []);
        // This stuff needs to be fast.
        await Promise.all(
            items.map(async (item) => {
                const info = await deps.getPipEnvInfo(item.path);
                if (info) {
                    item.type = InterpreterType.Pipenv;
                    item.pipEnvWorkspaceFolder = info.workspaceFolder.fsPath;
                    item.envName = info.envName || item.envName;
                }
            })
        );
        return items;
    }
}
