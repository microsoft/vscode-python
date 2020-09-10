// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { traceWarning } from '../../../../common/logger';
import { getEnvironmentVariable } from '../../../../common/utils/platform';
import { isWindowsPythonExe } from '../../../common/windowsUtils';

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
 * @param {string} interpreterPath : Absolute path to the python interpreter.
 * @returns {boolean} : Returns true if `interpreterPath` is under
 * `%ProgramFiles%/WindowsApps`.
 */
export function isForbiddenStorePath(interpreterPath:string):boolean {
    const programFilesStorePath = path
        .join(getEnvironmentVariable('ProgramFiles') || 'Program Files', 'WindowsApps')
        .normalize()
        .toUpperCase();
    return path.normalize(interpreterPath).toUpperCase().includes(programFilesStorePath);
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
    const pythonPathToCompare = path.normalize(interpreterPath).toUpperCase();
    const localAppDataStorePath = path
        .normalize(getWindowsStoreAppsRoot())
        .toUpperCase();
    if (pythonPathToCompare.includes(localAppDataStorePath)) {
        return true;
    }

    // Program Files store path is a forbidden path. Only admins and system has access this path.
    // We should never have to look at this path or even execute python from this path.
    if (isForbiddenStorePath(pythonPathToCompare)) {
        traceWarning('isWindowsStoreEnvironment called with Program Files store path.');
        return true;
    }
    return false;
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
    const windowsAppsRoot = getWindowsStoreAppsRoot();

    // Collect python*.exe directly under %LOCALAPPDATA%/Microsoft/WindowsApps
    const files = await fsapi.readdir(windowsAppsRoot);
    return files
        .map((filename:string) => path.join(windowsAppsRoot, filename))
        .filter(isWindowsPythonExe);
}

// tslint:disable-next-line: no-suspicious-comment
// TODO: The above APIs will be consumed by the Windows Store locator class when we have it.
