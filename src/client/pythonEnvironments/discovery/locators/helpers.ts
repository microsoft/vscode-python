import * as fsapi from 'fs-extra';
import { inject } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError } from '../../../common/logger';
import { IS_WINDOWS } from '../../../common/platform/constants';
import { IFileSystem } from '../../../common/platform/types';
import { IPipEnvServiceHelper } from '../../../interpreter/locators/types';
import {
    areSameInterpreter,
    InterpreterType,
    normalizeInterpreter,
    PythonInterpreter,
    updateInterpreter
} from '../../info';
import { areSameVersion } from '../../info/pythonVersion';

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
            updateInterpreter,
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
            merged.map(async (interp) => updateEnvInfo(interp, deps))
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
        updateInterpreter(i: PythonInterpreter, o: PythonInterpreter): void;
    }
): PythonInterpreter[] {
    return interpreters.reduce<PythonInterpreter[]>((accumulator, current) => {
        const existingItem = accumulator.find((item) => deps.areSameInterpreter(current, item));
        if (!existingItem) {
            const copied: PythonInterpreter = { ...current };
            deps.normalizeInterpreter(copied);
            accumulator.push(copied);
        } else {
            deps.updateInterpreter(existingItem, current);
        }
        return accumulator;
    }, []);
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
 * Update the given env info with extra information.
 *
 * @param interp - the env info to update
 * @param deps - functional dependencies
 * @prop deps.getPipEnvInfo - provides extra pip-specific env info, if applicable
 */
async function updateEnvInfo(
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
