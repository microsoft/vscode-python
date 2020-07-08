// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { traceDecorators } from '../../../../common/logger';
import { IFileSystem } from '../../../../common/platform/types';
import { IPythonExecutionFactory } from '../../../../common/process/types';
import { IPersistentStateFactory } from '../../../../common/types';
import { IInterpreterHashProvider, IWindowsStoreInterpreter } from '../../../../interpreter/locators/types';
import { IServiceContainer } from '../../../../ioc/types';

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
 * @implements {IInterpreterHashProvider}
 */
@injectable()
export class WindowsStoreInterpreter implements IWindowsStoreInterpreter, IInterpreterHashProvider {
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IPersistentStateFactory) private readonly persistentFactory: IPersistentStateFactory,
        @inject(IFileSystem) private readonly fs: IFileSystem
    ) {}
    /**
     * Whether this is a Windows Store/App Interpreter.
     *
     * @param {string} pythonPath
     * @returns {boolean}
     * @memberof WindowsStoreInterpreter
     */
    public isWindowsStoreInterpreter(pythonPath: string): boolean {
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
    public isHiddenInterpreter(pythonPath: string): boolean {
        return isRestrictedWindowsStoreInterpreterPath(pythonPath);
    }
    /**
     * Gets the hash of the Python interpreter (installed from the windows store).
     * We need to use a special way to get the hash for these, by first resolving the
     * path to the actual executable and then calculating the hash on that file.
     *
     * Using fs.lstat or similar nodejs functions do not work, as these are some weird form of symbolic linked files.
     *
     * Note: Store the hash in a temporary state store (as we're spawning processes here).
     * Spawning processes to get a hash of a terminal is expensive.
     * Hence to minimize resource usage (just to get a file hash), we will cache the generated hash for 1hr.
     * (why 1hr, simple, why 2hrs, or 3hrs.)
     * If user installs/updates/uninstalls Windows Store Python apps, 1hr is enough time to get things rolling again.
     *
     * @param {string} pythonPath
     * @returns {Promise<string>}
     * @memberof InterpreterHelper
     */
    @traceDecorators.error('Get Windows Store Interpreter Hash')
    public async getInterpreterHash(pythonPath: string): Promise<string> {
        const key = `WINDOWS_STORE_INTERPRETER_HASH_${pythonPath}`;
        const stateStore = this.persistentFactory.createGlobalPersistentState<string | undefined>(
            key,
            undefined,
            60 * 60 * 1000
        );

        if (stateStore.value) {
            return stateStore.value;
        }
        const executionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonService = await executionFactory.create({ pythonPath });
        const executablePath = await pythonService.getExecutablePath();
        // If we are unable to get file hash of executable, then get hash of parent directory.
        // Its likely it will fail for the executable (fails during development, but try nevertheless - in case things start working).
        const hash = await this.fs
            .getFileHash(executablePath)
            .catch(() => this.fs.getFileHash(path.dirname(executablePath)));
        await stateStore.updateValue(hash);

        return hash;
    }
}
