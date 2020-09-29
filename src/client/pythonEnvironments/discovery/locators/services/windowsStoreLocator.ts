// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { Event, EventEmitter } from 'vscode';
import { Architecture } from '../../../../common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonReleaseLevel, PythonVersion,
} from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import { ILocator, IPythonEnvsIterator } from '../../../base/locator';
import { PythonEnvsChangedEvent } from '../../../base/watcher';
import { getFileInfo } from '../../../common/externalDependencies';
import { getWindowsStoreAppsRoot, isWindowsPythonExe, isWindowsStoreEnvironment } from '../../../common/windowsUtils';
import { IEnvironmentInfoService } from '../../../info/environmentInfoService';

/**
 * Gets paths to the Python executable under Windows Store apps.
 * @returns: Returns python*.exe for the windows store app root directory.
 *
 * Remarks: We don't need to find the path to the interpreter under the specific application
 * directory. Such as:
 * `%LOCALAPPDATA%/Microsoft/WindowsApps/PythonSoftwareFoundation.Python.3.7_qbz5n2kfra8p0`
 * The same python executable is also available at:
 * `%LOCALAPPDATA%/Microsoft/WindowsApps`
 * It would be a duplicate.
 *
 * All python executable under `%LOCALAPPDATA%/Microsoft/WindowsApps` or the sub-directories
 * are 'reparse points' that point to the real executable at `%PROGRAMFILES%/WindowsApps`.
 * However, that directory is off limits to users. So no need to populate interpreters from
 * that location.
 */
export async function getWindowsStorePythonExes(): Promise<string[]> {
    const windowsAppsRoot = getWindowsStoreAppsRoot();

    // Collect python*.exe directly under %LOCALAPPDATA%/Microsoft/WindowsApps
    const files = await fsapi.readdir(windowsAppsRoot);
    return files
        .map((filename:string) => path.join(windowsAppsRoot, filename))
        .filter(isWindowsPythonExe);
}

export class WindowsStoreLocator implements ILocator {
    private readonly kind:PythonEnvKind = PythonEnvKind.WindowsStore;

    private readonly eventEmitter = new EventEmitter<PythonEnvsChangedEvent>();

    public constructor(private readonly envService:IEnvironmentInfoService) { }

    public iterEnvs(): IPythonEnvsIterator {
        const buildEnvInfo = (exe:string) => this.buildEnvInfo(exe);
        const iterator = async function* () {
            const exes = await getWindowsStorePythonExes();
            yield* exes.map(buildEnvInfo);
        };
        return iterator();
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        if (isWindowsStoreEnvironment(executablePath)) {
            const interpreterInfo = await this.envService.getEnvironmentInfo(executablePath);
            if (interpreterInfo) {
                const data = await getFileInfo(executablePath);
                interpreterInfo.executable = {
                    ...interpreterInfo.executable,
                    ...data,
                };
                return Promise.resolve({
                    id: '',
                    name: '',
                    location: '',
                    kind: this.kind,
                    executable: interpreterInfo.executable,
                    version: interpreterInfo.version,
                    arch: interpreterInfo.arch,
                    distro: { org: 'Microsoft' },
                });
            }
        }
        return undefined;
    }

    public get onChanged(): Event<PythonEnvsChangedEvent> {
        return this.eventEmitter.event;
    }

    private async buildEnvInfo(exe:string): Promise<PythonEnvInfo> {
        let version:PythonVersion;
        try {
            version = parseVersion(path.basename(exe));
        } catch (e) {
            version = {
                major: 3,
                minor: -1,
                micro: -1,
                release: { level: PythonReleaseLevel.Unknown, serial: -1 },
                sysVersion: undefined,
            };
        }
        return {
            id: '',
            name: '',
            location: '',
            kind: this.kind,
            executable: {
                filename: exe,
                sysPrefix: '',
                ...(await getFileInfo(exe)),
            },
            version,
            arch: Architecture.x64,
            distro: { org: 'Microsoft' },
        };
    }
}
