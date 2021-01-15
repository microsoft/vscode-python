// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IComponentAdapter } from '../../../../interpreter/contracts';
import { IWindowsStoreInterpreter } from '../../../../interpreter/locators/types';

/**
 * When using Windows Store interpreter the path that should be used is under
 * %USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python*.exe. The python.exe path
 * under ProgramFiles\WindowsApps should not be used at all. Execute permissions on
 * that instance of the store interpreter are restricted to system. Paths under
 * %USERPROFILE%\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation* are also ok
 * to use. But currently this results in duplicate entries.
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

// The parts of IComponentAdapter used here.
interface IComponent {
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined>;
}

/**
 * The default location of Windows apps are `%ProgramFiles%\WindowsApps`.
 * (https://www.samlogic.net/articles/windows-8-windowsapps-folder.htm)
 * When users access Python interpreter it is installed in `<users local folder>\Microsoft\WindowsApps`
 * Based on our testing this is where Python interpreters installed from Windows Store is always installed.
 * (unfortunately couldn't find any documentation on this).
 * What we've identified is the fact that:
 * - The Python interpreter in Microsoft\WIndowsApps\python.exe is a symbolic link to files located in:
 *  - Program Files\WindowsApps\ & Microsoft\WindowsApps\PythonSoftwareFoundation
 * - I.e. they all point to the same place.
 * However when the user launches the executable, its located in `Microsoft\WindowsApps\python.exe`
 * Hence for all intensive purposes that's the main executable, that's what the user uses.
 * As a result:
 * - We'll only display what the user has access to, that being `Microsoft\WindowsApps\python.exe`
 * - Others are hidden.
 *
 * Details can be found here (original issue https://github.com/microsoft/vscode-python/issues/5926).
 *
 * @export
 * @class WindowsStoreInterpreter
 * @implements {IWindowsStoreInterpreter}
 */
@injectable()
export class WindowsStoreInterpreter implements IWindowsStoreInterpreter {
    constructor(@inject(IComponentAdapter) private readonly pyenvs: IComponent) {}

    /**
     * Whether this is a Windows Store/App Interpreter.
     *
     * @param {string} pythonPath
     * @returns {boolean}
     * @memberof WindowsStoreInterpreter
     */
    public async isWindowsStoreInterpreter(pythonPath: string): Promise<boolean> {
        const result = await this.pyenvs.isWindowsStoreInterpreter(pythonPath);
        if (result !== undefined) {
            return result;
        }
        const pythonPathToCompare = pythonPath.toUpperCase().replace(/\//g, '\\');
        return (
            pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\'.toUpperCase()) ||
            pythonPathToCompare.includes('\\Program Files\\WindowsApps\\'.toUpperCase()) ||
            pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\PythonSoftwareFoundation'.toUpperCase())
        );
    }

    /**
     * Whether this is a python executable in a windows app store folder that is internal and can be hidden from users.
     * Interpreters that fall into this category will not be displayed to the users.
     *
     * @param {string} pythonPath
     * @returns {Promise<boolean>}
     * @memberof IInterpreterHelper
     */
    // eslint-disable-next-line class-methods-use-this
    public isHiddenInterpreter(pythonPath: string): boolean {
        return isRestrictedWindowsStoreInterpreterPath(pythonPath);
    }
}
