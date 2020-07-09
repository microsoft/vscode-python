import * as fsapi from 'fs-extra';
import { inject } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IS_WINDOWS } from '../../../common/platform/constants';
import { IFileSystem } from '../../../common/platform/types';
import { IPipEnvServiceHelper } from '../../../interpreter/locators/types';
import { InterpreterType, PythonInterpreter } from '../../info';

const CheckPythonInterpreterRegEx = IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

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
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPipEnvServiceHelper) private readonly pipEnvServiceHelper: IPipEnvServiceHelper
    ) {}

    public async mergeInterpreters(interpreters: PythonInterpreter[]): Promise<PythonInterpreter[]> {
        const deps = {
            arePathsSame: this.fs.arePathsSame,
            getPipEnvInfo: this.pipEnvServiceHelper.getPipEnvInfo.bind(this.pipEnvServiceHelper),
            normalizePath: path.normalize,
            getPathDirname: path.dirname
        };
        const normalized = interpreters.map((interp) => normalizeInterpreter(interp, deps));
        const merged = mergeInterpreters(normalized, deps);
        await Promise.all(
            // At this point they are independent so we can update them separately.
            merged.map(async (interp) => updateInterpreter(interp, deps))
        );
        return merged;
    }
}

/**
 * Make a copy of the env info and standardize the data.
 *
 * @param interp = the env info to normalize
 * @param deps - functional dependencies
 * @prop deps.normalizePath - (like `path.normalize`)
 */
function normalizeInterpreter(
    interp: PythonInterpreter,
    deps: {
        normalizePath(p: string): string;
    }
): PythonInterpreter {
    const normalized = { ...interp };
    normalized.path = deps.normalizePath(interp.path);
    return normalized;
}

/**
 * Combine env info for matching environments.
 *
 * Environments are matched by path and version.
 *
 * @param interpreters - the env infos to merge
 * @param deps - functional dependencies
 * @prop deps.arePathsSame - determine if two filenames point to the same file
 * @prop deps.getPathDirname - (like `path.dirname`)
 */
function mergeInterpreters(
    interpreters: PythonInterpreter[],
    deps: {
        arePathsSame(p1: string, p2: string): boolean;
        getPathDirname(p: string): string;
    }
): PythonInterpreter[] {
    return interpreters.reduce<PythonInterpreter[]>((accumulator, current) => {
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
}

/**
 * Update the given env info with extra information.
 *
 * @param interp - the env info to update
 * @param deps - functional dependencies
 * @prop deps.getPipEnvInfo - provides extra pip-specific env info, if applicable
 */
async function updateInterpreter(
    interp: PythonInterpreter,
    deps: {
        getPipEnvInfo(p: string): Promise<{ workspaceFolder: Uri; envName: string } | undefined>;
    }
) {
    // This stuff needs to be fast.
    const info = await deps.getPipEnvInfo(interp.path);
    if (info) {
        interp.type = InterpreterType.Pipenv;
        interp.pipEnvWorkspaceFolder = info.workspaceFolder.fsPath;
        if (info.envName) {
            interp.envName = info.envName;
        }
    }
}
