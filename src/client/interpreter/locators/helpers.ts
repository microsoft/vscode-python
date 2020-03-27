import { inject, injectable } from 'inversify';
import * as path from 'path';
import { traceError } from '../../common/logger';
import { IS_WINDOWS } from '../../common/platform/constants';
import { IFileSystem } from '../../common/platform/types';
import { IInterpreterLocatorHelper, InterpreterType, PythonInterpreter } from '../contracts';
import { IPipEnvServiceHelper } from './types';

const CheckPythonInterpreterRegEx = IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

export async function lookForInterpretersInDirectory(pathToCheck: string, fs: IFileSystem): Promise<string[]> {
    // Technically, we should be able to use fs.getFiles().  However,
    // that breaks some tests.  So we stick with the broader behavior.
    try {
        const subDirs = await fs.listdir(pathToCheck);
        return subDirs
            .map(([filename, _ft]) => filename)
            .filter((fileName) => CheckPythonInterpreterRegEx.test(path.basename(fileName)));
    } catch (err) {
        traceError('Python Extension (lookForInterpretersInDirectory.fs.listdir):', err);
        return [] as string[];
    }
}

@injectable()
export class InterpreterLocatorHelper implements IInterpreterLocatorHelper {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPipEnvServiceHelper) private readonly pipEnvServiceHelper: IPipEnvServiceHelper
    ) {}
    public async mergeInterpreters(interpreters: PythonInterpreter[]): Promise<PythonInterpreter[]> {
        const items = interpreters
            .map((item) => {
                return { ...item };
            })
            .map((item) => {
                item.path = path.normalize(item.path);
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
                        this.fs.arePathsSame(path.dirname(item.path), path.dirname(current.path))
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
                        'version',
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
                const info = await this.pipEnvServiceHelper.getPipEnvInfo(item.path);
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
