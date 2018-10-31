// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { coerce, SemVer } from 'semver';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { IExtensionApi } from '../client/api';
import { PythonSettings } from '../client/common/configSettings';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { traceError } from '../client/common/logger';
import { BufferDecoder } from '../client/common/process/decoder';
import { ProcessService } from '../client/common/process/proc';
import { IProcessService } from '../client/common/process/types';
import { noop } from '../client/common/utils/misc';
import { getOSType, OSType } from '../client/common/utils/platform';
import { IServiceContainer } from '../client/ioc/types';
import { IS_MULTI_ROOT_TEST } from './initialize';

export { sleep } from './core';

// tslint:disable:no-invalid-this no-any

const fileInNonRootWorkspace = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'dummy.py');
export const rootWorkspaceUri = getWorkspaceRoot();

export const PYTHON_PATH = getPythonPath();

export type PythonSettingKeys = 'workspaceSymbols.enabled' | 'pythonPath' |
    'linting.lintOnSave' |
    'linting.enabled' | 'linting.pylintEnabled' |
    'linting.flake8Enabled' | 'linting.pep8Enabled' | 'linting.pylamaEnabled' |
    'linting.prospectorEnabled' | 'linting.pydocstyleEnabled' | 'linting.mypyEnabled' | 'linting.banditEnabled' |
    'unitTest.nosetestArgs' | 'unitTest.pyTestArgs' | 'unitTest.unittestArgs' |
    'formatting.provider' | 'sortImports.args' |
    'unitTest.nosetestsEnabled' | 'unitTest.pyTestEnabled' | 'unitTest.unittestEnabled' |
    'envFile';

export async function updateSetting(setting: PythonSettingKeys, value: {} | undefined, resource: Uri | undefined, configTarget: ConfigurationTarget) {
    const settings = workspace.getConfiguration('python', resource);
    const currentValue = settings.inspect(setting);
    if (currentValue !== undefined && ((configTarget === ConfigurationTarget.Global && currentValue.globalValue === value) ||
        (configTarget === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
        (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
        PythonSettings.dispose();
        return;
    }
    await settings.update(setting, value, configTarget);

    // We've experienced trouble with .update in the past, where VSC returns stale data even
    // after invoking the update method. This issue has regressed a few times as well. This
    // delay is merely a backup to ensure it extension doesn't break the tests due to similar
    // regressions in VSC:
    // await sleep(2000);
    // ... please see issue #2356 and PR #2332 for a discussion on the matter

    PythonSettings.dispose();
}

// In some tests we will be mocking VS Code API (mocked classes)
const globalPythonPathSetting = workspace.getConfiguration('python') ? workspace.getConfiguration('python').inspect('pythonPath')!.globalValue : 'python';

export const clearPythonPathInWorkspaceFolder = async (resource: string | Uri) => retryAsync(setPythonPathInWorkspace)(resource, ConfigurationTarget.WorkspaceFolder);

export const setPythonPathInWorkspaceRoot = async (pythonPath: string) => retryAsync(setPythonPathInWorkspace)(undefined, ConfigurationTarget.Workspace, pythonPath);

export const resetGlobalPythonPathSetting = async () => retryAsync(restoreGlobalPythonPathSetting)();

function getWorkspaceRoot() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return Uri.file(path.join(EXTENSION_ROOT_DIR, 'src', 'test'));
    }
    if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    }
    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(fileInNonRootWorkspace));
    return workspaceFolder ? workspaceFolder.uri : workspace.workspaceFolders[0].uri;
}

export function retryAsync(wrapped: Function, retryCount: number = 2) {
    return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
            const reasons: any[] = [];

            const makeCall = () => {
                wrapped.call(this as Function, ...args)
                    .then(resolve, (reason: any) => {
                        reasons.push(reason);
                        if (reasons.length >= retryCount) {
                            reject(reasons);
                        } else {
                            // If failed once, lets wait for some time before trying again.
                            setTimeout(makeCall, 500);
                        }
                    });
            };

            makeCall();
        });
    };
}

async function setPythonPathInWorkspace(resource: string | Uri | undefined, config: ConfigurationTarget, pythonPath?: string) {
    if (config === ConfigurationTarget.WorkspaceFolder && !IS_MULTI_ROOT_TEST) {
        return;
    }
    const resourceUri = typeof resource === 'string' ? Uri.file(resource) : resource;
    const settings = workspace.getConfiguration('python', resourceUri);
    const value = settings.inspect<string>('pythonPath');
    const prop: 'workspaceFolderValue' | 'workspaceValue' = config === ConfigurationTarget.Workspace ? 'workspaceValue' : 'workspaceFolderValue';
    if (value && value[prop] !== pythonPath) {
        await settings.update('pythonPath', pythonPath, config);
        PythonSettings.dispose();
    }
}
async function restoreGlobalPythonPathSetting(): Promise<void> {
    const pythonConfig = workspace.getConfiguration('python', null as any as Uri);
    const currentGlobalPythonPathSetting = pythonConfig.inspect('pythonPath')!.globalValue;
    if (globalPythonPathSetting !== currentGlobalPythonPathSetting) {
        await pythonConfig.update('pythonPath', undefined, true);
    }
    PythonSettings.dispose();
}

export async function deleteDirectory(dir: string) {
    const exists = await fs.pathExists(dir);
    if (exists) {
        await fs.remove(dir);
    }
}

export async function deleteFile(file: string) {
    const exists = await fs.pathExists(file);
    if (exists) {
        await fs.remove(file);
    }
}

export async function deleteFiles(globPattern: string) {
    const items = await new Promise<string[]>((resolve, reject) => {
        glob(globPattern, (ex, files) => ex ? reject(ex) : resolve(files));
    });

    return Promise.all(items.map(item => fs.remove(item).catch(noop)));
}
function getPythonPath(): string {
    if (process.env.CI_PYTHON_PATH && fs.existsSync(process.env.CI_PYTHON_PATH)) {
        return process.env.CI_PYTHON_PATH;
    }
    return 'python';
}

/**
 * Determine if the current platform is included in a list of platforms.
 *
 * @param {OSes} OSType[] List of operating system Ids to check within.
 * @return true if the current OS matches one from the list, false otherwise.
 */
export function isOs(...OSes: OSType[]): boolean {
    // get current OS
    const currentOS: OSType = getOSType();
    // compare and return
    if (OSes.indexOf(currentOS) === -1) {
        return false;
    }
    return true;
}

/**
 * Get the current Python interpreter version.
 *
 * @param {procService} IProcessService Optionally specify the IProcessService implementation to use to execute with.
 * @return `SemVer` version of the Python interpreter, or `undefined` if an error occurs.
 */
export async function getPythonSemVer(procService?: IProcessService): Promise<SemVer | undefined> {
    const pythonProcRunner = procService ? procService : new ProcessService(new BufferDecoder());
    const pyVerArgs = ['-c', 'import sys;print("{0}.{1}.{2}".format(*sys.version_info[:3]))'];

    return pythonProcRunner.exec(PYTHON_PATH, pyVerArgs)
        .then(strVersion => new SemVer(strVersion.stdout.trim()))
        .catch((err) => {
            // if the call fails this should make it loudly apparent.
            traceError('getPythonSemVer', err);
            return undefined;
        });
}

/**
 * Match a given semver version specification with a list of loosely defined
 * version strings.
 *
 * Specify versions by their major version at minimum - the minor and patch
 * version numbers are optional.
 *
 * '3', '3.6', '3.6.6', are all vald and only the portions specified will be matched
 * against the current running Python interpreter version.
 *
 * Example scenarios:
 * '3' will match version 3.5.6, 3.6.4, 3.6.6, and 3.7.0.
 * '3.6' will match version 3.6.4 and 3.6.6.
 * '3.6.4' will match version 3.6.4 only.
 *
 * @param {version} SemVer the version to look for.
 * @param {searchVersions} string[] List of loosely-specified versions to match against.
 */
export function isVersionInList(version: SemVer, ...searchVersions: string[]): boolean {
    // see if the major/minor version matches any member of the skip-list.
    const isPresent = searchVersions.findIndex(ver => {
        const semverChecker = coerce(ver);
        if (semverChecker) {
            if (semverChecker.compare(version) === 0) {
                return true;
            } else {
                // compare all the parts of the version that we have, we know we have
                // at minimum the major version or semverChecker would be 'null'...
                const versionParts = ver.split('.');
                let matches = parseInt(versionParts[0], 10) === version.major;

                if (matches && versionParts.length >= 2) {
                    matches = parseInt(versionParts[1], 10) === version.minor;
                }

                if (matches && versionParts.length >= 3) {
                    matches = parseInt(versionParts[2], 10) === version.patch;
                }

                return matches;
            }
        }
        return false;
    });

    if (isPresent >= 0) {
        return true;
    }
    return false;
}

/**
 * Determine if the Python interpreter version running in a given `IProcessService`
 * is in a selection of versions.
 *
 * You can specify versions by specifying the major version at minimum - the minor and
 * patch version numbers are optional.
 *
 * '3', '3.6', '3.6.6', are all vald and only the portions specified will be matched
 * against the current running Python interpreter version.
 *
 * Example scenarios:
 * '3' will match version 3.5.6, 3.6.4, 3.6.6, and 3.7.0.
 * '3.6' will match version 3.6.4 and 3.6.6.
 * '3.6.4' will match version 3.6.4 only.
 *
 * If you don't need to specify the environment (ie. the workspace) that the Python
 * interpreter is running under, use the simpler `isPythonVersion` instead.
 *
 * @param {procService} IProcessService Optionally, use this process service to call out to python with.
 * @param {versions} string[] Python versions to test for, specified as described above.
 * @return true if the current Python version matches a version in the skip list, false otherwise.
 */
export async function isPythonVersionInProcess(procService?: IProcessService, ...versions: string[]): Promise<boolean> {
    // get the current python version major/minor
    const currentPyVersion = await getPythonSemVer(procService);
    if (currentPyVersion) {
        return isVersionInList(currentPyVersion, ...versions);
    } else {
        traceError(`Failed to determine the current Python version when comparing against list [${versions.join(', ')}].`);
        return false;
    }
}

/**
 * Determine if the current interpreter version is in a given selection of versions.
 *
 * You can specify versions by using up to the first three semver parts of a python
 * version.
 *
 * '3', '3.6', '3.6.6', are all vald and only the portions specified will be matched
 * against the current running Python interpreter version.
 *
 * Example scenarios:
 * '3' will match version 3.5.6, 3.6.4, 3.6.6, and 3.7.0.
 * '3.6' will match version 3.6.4 and 3.6.6.
 * '3.6.4' will match version 3.6.4 only.
 *
 * If you need to specify the environment (ie. the workspace) that the Python
 * interpreter is running under, use `isPythonVersionInProcess` instead.
 *
 * @param {versions} string[] List of versions of python that are to be skipped.
 * @param {resource} vscode.Uri Current workspace resource Uri or undefined.
 * @return true if the current Python version matches a version in the skip list, false otherwise.
 */
export async function isPythonVersion(...versions: string[]): Promise<boolean> {
    const currentPyVersion = await getPythonSemVer();
    if (currentPyVersion) {
        return isVersionInList(currentPyVersion, ...versions);
    } else {
        traceError(`Failed to determine the current Python version when comparing against list [${versions.join(', ')}].`);
        return false;
    }
}

export interface IExtensionTestApi extends IExtensionApi {
    serviceContainer: IServiceContainer;
}
