// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as minimatch from 'minimatch';
import * as path from 'path';
import { PythonEnvKind } from '../../info';
import { IPythonEnvsIterator, BasicEnvInfo } from '../../locator';
import { FSWatchingLocator } from './fsWatchingLocator';
import { PythonEnvStructure } from '../../../common/pythonBinariesWatcher';
import { isStorePythonInstalled, getWindowsStoreAppsRoot } from '../../../common/environmentManagers/windowsStoreEnv';

/**
 * This is a glob pattern which matches following file names:
 * python3.8.exe
 * python3.9.exe
 * python3.10.exe
 * This pattern does not match:
 * python.exe
 * python2.7.exe
 * python3.exe
 * python38.exe
 * Note chokidar fails to match multiple digits using +([0-9]), even though the underlying glob pattern matcher
 * they use (picomatch), or any other glob matcher does. Hence why we had to use {[0-9],[0-9][0-9]} instead.
 */
const pythonExeGlob = 'python3.{[0-9],[0-9][0-9]}.exe';

/**
 * This is a glob pattern which matches following dir names:
 * PythonSoftwareFoundation.Python.3.9_qbz5n2kfra8p0
 * PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0
 *
 * Note chokidar fails to match multiple digits using +([0-9]), even though the underlying glob pattern matcher
 * they use (picomatch), or any other glob matcher does. Hence why we had to use {[0-9],[0-9][0-9]} instead.
 */
const storePythonDirGlob = 'PythonSoftwareFoundation.Python.3.{[0-9],[0-9][0-9]}_*';

/**
 * Checks if a given path ends with python3.*.exe. Not all python executables are matched as
 * we do not want to return duplicate executables.
 * @param {string} interpreterPath : Path to python interpreter.
 * @returns {boolean} : Returns true if the path matches pattern for windows python executable.
 */
function isWindowsStorePythonExePattern(interpreterPath: string): boolean {
    return minimatch(path.basename(interpreterPath), pythonExeGlob, { nocase: true });
}

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
    if (await isStorePythonInstalled()) {
        const windowsAppsRoot = getWindowsStoreAppsRoot();

        // Collect python*.exe directly under %LOCALAPPDATA%/Microsoft/WindowsApps
        const files = await fsapi.readdir(windowsAppsRoot);
        return files
            .map((filename: string) => path.join(windowsAppsRoot, filename))
            .filter(isWindowsStorePythonExePattern);
    }
    return [];
}

export class WindowsStoreLocator extends FSWatchingLocator<BasicEnvInfo> {
    private readonly kind: PythonEnvKind = PythonEnvKind.WindowsStore;

    constructor() {
        // We have to watch the directory instead of the executable here because
        // FS events are not triggered for `*.exe` in the WindowsApps folder. The
        // .exe files here are reparse points and not real files. Watching the
        // PythonSoftwareFoundation directory will trigger both for new install
        // and update case. Update is handled by deleting and recreating the
        // PythonSoftwareFoundation directory.
        super(getWindowsStoreAppsRoot, async () => this.kind, {
            baseGlob: storePythonDirGlob,
            searchLocation: getWindowsStoreAppsRoot(),
            envStructure: PythonEnvStructure.Flat,
        });
    }

    protected doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const iterator = async function* (kind: PythonEnvKind) {
            const exes = await getWindowsStorePythonExes();
            yield* exes.map(async (executablePath: string) => ({
                kind,
                executablePath,
            }));
        };
        return iterator(this.kind);
    }
}
