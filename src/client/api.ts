// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { isTestExecution } from './common/constants';
import { DebugAdapterNewPtvsd } from './common/experimentGroups';
import { traceError } from './common/logger';
import { IExperimentsManager } from './common/types';
import { getDebugpyLauncherArgs, getPtvsdLauncherScriptArgs } from './debugger/extension/adapter/remoteLaunchers';
import { IServiceContainer, IServiceManager } from './ioc/types';

/*
 * Do not introduce any breaking changes to this API.
 * This is the public API for other extensions to interact with this extension.
 */

export interface IExtensionApi {
    /**
     * Promise indicating whether all parts of the extension have completed loading or not.
     * @type {Promise<void>}
     * @memberof IExtensionApi
     */
    ready: Promise<void>;
    debug: {
        /**
         * Generate an array of strings for commands to pass to the Python executable to launch the debugger for remote debugging.
         * Users can append another array of strings of what they want to execute along with relevant arguments to Python.
         * E.g `['/Users/..../pythonVSCode/pythonFiles/ptvsd_launcher.py', '--host', 'localhost', '--port', '57039', '--wait']`
         * @param {string} host
         * @param {number} port
         * @param {boolean} [waitUntilDebuggerAttaches=true]
         * @returns {Promise<string[]>}
         */
        getRemoteLauncherCommand(host: string, port: number, waitUntilDebuggerAttaches: boolean): Promise<string[]>;
    };
}

export function buildApi(
    // tslint:disable-next-line:no-any
    ready: Promise<any>,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
) {
    const experimentsManager = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    const api = {
        // 'ready' will propagate the exception, but we must log it here first.
        ready: ready.catch((ex) => {
            traceError('Failure during activation.', ex);
            return Promise.reject(ex);
        }),
        debug: {
            async getRemoteLauncherCommand(
                host: string,
                port: number,
                waitUntilDebuggerAttaches: boolean = true
            ): Promise<string[]> {
                const useNewDADebugger = experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment);

                if (useNewDADebugger) {
                    return getDebugpyLauncherArgs({
                        host,
                        port,
                        waitUntilDebuggerAttaches
                    });
                }

                return getPtvsdLauncherScriptArgs({
                    host,
                    port,
                    waitUntilDebuggerAttaches
                });
            }
        }
    };

    // In test environment return the DI Container.
    if (isTestExecution()) {
        // tslint:disable:no-any
        (api as any).serviceContainer = serviceContainer;
        (api as any).serviceManager = serviceManager;
        // tslint:enable:no-any
    }
    return api;
}
