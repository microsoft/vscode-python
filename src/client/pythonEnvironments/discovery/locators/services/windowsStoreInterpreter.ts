// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/**
 * When using Windows Store interpreter the path that should be used is under
 * %USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python*.exe. The python.exe path
 * under ProgramFiles\WindowsApps should not be used at all. Execute permissions on
 * that instance of the store interpreter are restricted to system. Paths under
 * %USERPROFILE%\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation* are also ok
 * to use. But currently this results in duplicate entries.
 * Interpreters that fall into this category will not be displayed to the users.
 *
 * @param {string} pythonPath
 * @returns {boolean}
 */
export function isRestrictedWindowsStoreInterpreterPath(pythonPath: string): boolean {
    const pythonPathToCompare = pythonPath.toUpperCase().replace(/\//g, '\\');

    return (
        pythonPathToCompare.includes('\\Program Files\\WindowsApps\\'.toUpperCase()) ||
        pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\PythonSoftwareFoundation'.toUpperCase())
    );
}

/**
 * Whether this is a Windows Store/App Interpreter.
 *
 * @param {string} pythonPath
 * @param {IComponentAdapter} pyenvs
 * @returns {boolean}
 * @memberof WindowsStoreInterpreter
 */
export async function isWindowsStoreInterpreter(pythonPath: string): Promise<boolean> {
    const pythonPathToCompare = pythonPath.toUpperCase().replace(/\//g, '\\');
    return (
        pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\'.toUpperCase()) ||
        pythonPathToCompare.includes('\\Program Files\\WindowsApps\\'.toUpperCase()) ||
        pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\PythonSoftwareFoundation'.toUpperCase())
    );
}
