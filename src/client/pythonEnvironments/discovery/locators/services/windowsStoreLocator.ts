// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as minimatch from 'minimatch';
import * as path from 'path';
import { traceWarning } from '../../../../common/logger';
import { Architecture, getEnvironmentVariable } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { getPythonVersionFromPath } from '../../../base/info/pythonVersion';
import { IPythonEnvsIterator } from '../../../base/locator';
import { FSWatchingLocator } from '../../../base/locators/lowLevel/fsWatchingLocator';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';
import { PythonEnvStructure } from '../../../common/pythonBinariesWatcher';

/**
 * Gets path to the Windows Apps directory.
 * @returns {string} : Returns path to the Windows Apps directory under
 * `%LOCALAPPDATA%/Microsoft/WindowsApps`.
 */
export function getWindowsStoreAppsRoot(): string {
    const localAppData = getEnvironmentVariable('LOCALAPPDATA') || '';
    return path.join(localAppData, 'Microsoft', 'WindowsApps');
}

/**
 * Checks if a given path is under the forbidden windows store directory.
 * @param {string} absPath : Absolute path to a file or directory.
 * @returns {boolean} : Returns true if `interpreterPath` is under
 * `%ProgramFiles%/WindowsApps`.
 */
export function isForbiddenStorePath(absPath: string): boolean {
    const programFilesStorePath = path
        .join(getEnvironmentVariable('ProgramFiles') || 'Program Files', 'WindowsApps')
        .normalize()
        .toUpperCase();
    return path.normalize(absPath).toUpperCase().includes(programFilesStorePath);
}

/**
 * Checks if a given directory is any one of the possible windows store directories, or
 * its sub-directory.
 * @param {string} dirPath : Absolute path to a directory.
 *
 * Remarks:
 * These locations are tested:
 * 1. %LOCALAPPDATA%/Microsoft/WindowsApps
 * 2. %ProgramFiles%/WindowsApps
 */
export function isWindowsStoreDir(dirPath: string): boolean {
    const storeRootPath = path.normalize(getWindowsStoreAppsRoot()).toUpperCase();
    return path.normalize(dirPath).toUpperCase().includes(storeRootPath) || isForbiddenStorePath(dirPath);
}

/**
 * Checks if store python is installed.
 * @param {string} interpreterPath : Absolute path to a interpreter.
 * Remarks:
 * If store python was never installed then the store apps directory will not
 * have idle.exe or pip.exe. We can use this as a way to identify the python.exe
 * found in the store apps directory is a real python or a store install shortcut.
 */
async function isStorePythonInstalled(interpreterPath?: string): Promise<boolean> {
    let results = await Promise.all([
        pathExists(path.join(getWindowsStoreAppsRoot(), 'idle.exe')),
        pathExists(path.join(getWindowsStoreAppsRoot(), 'pip.exe')),
    ]);

    if (results.includes(true)) {
        return true;
    }

    if (interpreterPath) {
        results = await Promise.all([
            pathExists(path.join(path.dirname(interpreterPath), 'idle.exe')),
            pathExists(path.join(path.dirname(interpreterPath), 'pip.exe')),
        ]);
        return results.includes(true);
    }
    return false;
}

/**
 * Checks if the given interpreter belongs to Windows Store Python environment.
 * @param interpreterPath: Absolute path to any python interpreter.
 *
 * Remarks:
 * 1. Checking if the path includes `Microsoft\WindowsApps`, `Program Files\WindowsApps`, is
 * NOT enough. In WSL, `/mnt/c/users/user/AppData/Local/Microsoft/WindowsApps` is available as a search
 * path. It is possible to get a false positive for that path. So the comparison should check if the
 * absolute path to 'WindowsApps' directory is present in the given interpreter path. The WSL path to
 * 'WindowsApps' is not a valid path to access, Windows Store Python.
 *
 * 2. 'startsWith' comparison may not be right, user can provide '\\?\C:\users\' style long paths in windows.
 *
 * 3. A limitation of the checks here is that they don't handle 8.3 style windows paths.
 * For example,
 *     `C:\Users\USER\AppData\Local\MICROS~1\WINDOW~1\PYTHON~2.EXE`
 * is the shortened form of
 *     `C:\Users\USER\AppData\Local\Microsoft\WindowsApps\python3.7.exe`
 *
 * The correct way to compare these would be to always convert given paths to long path (or to short path).
 * For either approach to work correctly you need actual file to exist, and accessible from the user's
 * account.
 *
 * To convert to short path without using N-API in node would be to use this command. This is very expensive:
 * `> cmd /c for %A in ("C:\Users\USER\AppData\Local\Microsoft\WindowsApps\python3.7.exe") do @echo %~sA`
 * The above command will print out this:
 * `C:\Users\USER\AppData\Local\MICROS~1\WINDOW~1\PYTHON~2.EXE`
 *
 * If we go down the N-API route, use node-ffi and either call GetShortPathNameW or GetLongPathNameW from,
 * Kernel32 to convert between the two path variants.
 *
 */
export async function isWindowsStoreEnvironment(interpreterPath: string): Promise<boolean> {
    if (await isStorePythonInstalled(interpreterPath)) {
        const pythonPathToCompare = path.normalize(interpreterPath).toUpperCase();
        const localAppDataStorePath = path.normalize(getWindowsStoreAppsRoot()).toUpperCase();
        if (pythonPathToCompare.includes(localAppDataStorePath)) {
            return true;
        }

        // Program Files store path is a forbidden path. Only admins and system has access this path.
        // We should never have to look at this path or even execute python from this path.
        if (isForbiddenStorePath(pythonPathToCompare)) {
            traceWarning('isWindowsStoreEnvironment called with Program Files store path.');
            return true;
        }
    }
    return false;
}

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
 * Checks if a given path ends with python3.*.exe. Not all python executables are matched as
 * we do not want to return duplicate executables.
 * @param {string} interpreterPath : Path to python interpreter.
 * @returns {boolean} : Returns true if the path matches pattern for windows python executable.
 */
export function isWindowsStorePythonExePattern(interpreterPath: string): boolean {
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

export class WindowsStoreLocator extends FSWatchingLocator {
    private readonly kind: PythonEnvKind = PythonEnvKind.WindowsStore;

    constructor() {
        super(getWindowsStoreAppsRoot, async () => this.kind, {
            executableBaseGlob: pythonExeGlob,
            searchLocation: getWindowsStoreAppsRoot(),
            envStructure: PythonEnvStructure.Flat,
        });
    }

    protected doIterEnvs(): IPythonEnvsIterator {
        const iterator = async function* (kind: PythonEnvKind) {
            const exes = await getWindowsStorePythonExes();
            yield* exes.map(async (executable: string) =>
                buildEnvInfo({
                    kind,
                    executable,
                    version: getPythonVersionFromPath(executable),
                    org: 'Microsoft',
                    arch: Architecture.x64,
                    fileInfo: await getFileInfo(executable),
                    source: [PythonEnvSource.PathEnvVar],
                }),
            );
        };
        return iterator(this.kind);
    }

    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        const source =
            typeof env === 'string' ? [PythonEnvSource.PathEnvVar] : [PythonEnvSource.PathEnvVar, ...env.source];
        if (await isWindowsStoreEnvironment(executablePath)) {
            return buildEnvInfo({
                kind: this.kind,
                executable: executablePath,
                version: getPythonVersionFromPath(executablePath),
                org: 'Microsoft',
                arch: Architecture.x64,
                fileInfo: await getFileInfo(executablePath),
                source,
            });
        }
        return undefined;
    }
}
