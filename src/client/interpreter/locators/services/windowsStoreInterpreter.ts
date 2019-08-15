// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { traceDecorators } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { IPersistentStateFactory } from '../../../common/types';
import { IInterpreterHashProvider, IWindowsStoreInterpreter } from '../types';

@injectable()
export class WindowsStoreInterpreter implements IWindowsStoreInterpreter, IInterpreterHashProvider {
    constructor(
        @inject(IPythonExecutionFactory) private readonly executionFactory: IPythonExecutionFactory,
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
    public isInternalInterpreter(pythonPath: string): boolean {
        const pythonPathToCompare = pythonPath.toUpperCase().replace(/\//g, '\\');
        return (
            pythonPathToCompare.includes('\\Program Files\\WindowsApps\\'.toUpperCase()) ||
            pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\PythonSoftwareFoundation'.toUpperCase())
        );
    }
    /**
     * Gets the hash of the Python interpreter (installed from the windows store).
     * We need to use a special way to get the hash for these, by first resolving the
     * path to the actual executable and then calculating the hash on that file.
     *
     * Using fs.lstat or similar nodejs functions do not work, as these are some weird form of symbolic linked files.
     *
     * Note: Store the hash in a temporary state store (as we're spawning processes here).
     * That's expensive.
     *
     * @param {string} pythonPath
     * @returns {Promise<string>}
     * @memberof InterpreterHelper
     */
    @traceDecorators.error('Get Windows Store Interpreter Hash')
    public async getInterpreterHash(pythonPath: string): Promise<string> {
        const key = `WINDOWS_STORE_INTERPRETER_HASH_${pythonPath}`;
        const stateStore = this.persistentFactory.createGlobalPersistentState<string | undefined>(key, undefined, 60 * 60 * 1000);

        if (stateStore.value) {
            return stateStore.value;
        }
        const pythonService = await this.executionFactory.create({ pythonPath });
        const executablePath = await pythonService.getExecutablePath();
        const hash = await this.fs.getFileHash(executablePath);
        await stateStore.updateValue(hash);

        return hash;
    }
}
