import * as fsapi from 'fs-extra';
import { inject } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IS_WINDOWS } from '../../../common/platform/constants';
import { IFileSystem } from '../../../common/platform/types';
import { IPipEnvServiceHelper } from '../../../interpreter/locators/types';
import { InterpreterType, PythonInterpreter } from '../../info';
import { PythonVersion } from '../../info/pythonVersion';

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
            areSameInterpreter: (i1: PythonInterpreter, i2: PythonInterpreter) =>
                areSameInterpreter(i1, i2, {
                    areSameVersion,
                    inSameDirectory: (p1?: string, p2?: string) =>
                        inSameDirectory(p1, p2, {
                            arePathsSame: this.fs.arePathsSame,
                            getPathDirname: path.dirname
                        })
                }),
            normalizeInterpreter: (i: PythonInterpreter) => normalizeInterpreter(i, { normalizePath: path.normalize }),
            getPipEnvInfo: this.pipEnvServiceHelper.getPipEnvInfo.bind(this.pipEnvServiceHelper)
        };
        const merged = mergeInterpreters(interpreters, deps);
        await Promise.all(
            // At this point they are independent so we can update them separately.
            merged.map(async (interp) => updateInterpreter(interp, deps))
        );
        return merged;
    }
}

/**
 * Combine env info for matching environments.
 *
 * Environments are matched by path and version.
 *
 * @param interpreters - the env infos to merge
 * @param deps - functional dependencies
 * @prop deps.areSameInterpreter - determine if 2 infos match the same env
 * @prop deps.normalizeInterpreter - standardize the given env info
 */
function mergeInterpreters(
    interpreters: PythonInterpreter[],
    deps: {
        areSameInterpreter(i1: PythonInterpreter, i2: PythonInterpreter): boolean;
        normalizeInterpreter(i: PythonInterpreter): void;
    }
): PythonInterpreter[] {
    return interpreters.reduce<PythonInterpreter[]>((accumulator, current) => {
        const existingItem = accumulator.find((item) => deps.areSameInterpreter(current, item));
        if (!existingItem) {
            const copied: PythonInterpreter = { ...current };
            deps.normalizeInterpreter(copied);
            accumulator.push(copied);
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
 * Determine if the given infos correspond to the same env.
 *
 * @param interp1 - one of the two envs to compare
 * @param interp2 - one of the two envs to compare
 * @param deps - functional dependencies
 * @prop deps.areSameVersion - determine if two versions are the same
 * @prop deps.inSameDirectory - determine if two files are in the same directory
 */
function areSameInterpreter(
    interp1: PythonInterpreter | undefined,
    interp2: PythonInterpreter | undefined,
    deps: {
        areSameVersion(v1?: PythonVersion, v2?: PythonVersion): boolean;
        inSameDirectory(p1?: string, p2?: string): boolean;
    }
): boolean {
    if (!interp1 || !interp2) {
        return false;
    }
    if (!deps.areSameVersion(interp1.version, interp2.version)) {
        return false;
    }
    // Could be Python 3.6 with path = python.exe, and Python 3.6
    // and path = python3.exe, so we check the parent directory.
    if (!deps.inSameDirectory(interp1.path, interp2.path)) {
        return false;
    }
    return true;
}

/**
 * Determine if the given versions are the same.
 *
 * @param version1 - one of the two versions to compare
 * @param version2 - one of the two versions to compare
 */
function areSameVersion(version1?: PythonVersion, version2?: PythonVersion): boolean {
    if (!version1 || !version2) {
        return false;
    }
    return version1.raw === version2.raw;
}

/**
 * Determine if the given paths are in the same directory.
 *
 * @param path1 - one of the two paths to compare
 * @param path2 - one of the two paths to compare
 * @param deps - functional dependencies
 * @prop deps.arePathsSame - determine if two filenames point to the same file
 * @prop deps.getPathDirname - (like `path.dirname`)
 */
function inSameDirectory(
    path1: string | undefined,
    path2: string | undefined,
    deps: {
        arePathsSame(p1: string, p2: string): boolean;
        getPathDirname(p: string): string;
    }
): boolean {
    if (!path1 || !path2) {
        return false;
    }
    const dir1 = deps.getPathDirname(path1);
    const dir2 = deps.getPathDirname(path2);
    return deps.arePathsSame(dir1, dir2);
}

/**
 * Standardize the given env info.
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
): void {
    interp.path = deps.normalizePath(interp.path);
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
