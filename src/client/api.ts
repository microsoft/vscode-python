// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugAdapterNewPtvsd } from './common/experimentGroups';
import { traceError } from './common/logger';
import { IExperimentsManager } from './common/types';
import { RemoteDebuggerExternalLauncherScriptProvider } from './debugger/debugAdapter/DebugClients/launcherProvider';
import { IDebugAdapterDescriptorFactory } from './debugger/extension/types';

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
    experimentsManager: IExperimentsManager,
    debugFactory: IDebugAdapterDescriptorFactory
) {
    return {
        // 'ready' will propagate the exception, but we must log it here first.
        ready: ready.catch(ex => {
            traceError('Failure during activation.', ex);
            return Promise.reject(ex);
        }),
        debug: {
            async getRemoteLauncherCommand(
                host: string,
                port: number,
                waitUntilDebuggerAttaches: boolean = true
            ): Promise<string[]> {
                const useNewDAPtvsd = experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment);

                if (useNewDAPtvsd) {
                    // Same logic as in RemoteDebuggerExternalLauncherScriptProvider, but eventually launcherProvider.ts will be deleted.
                    const args = debugFactory.getRemotePtvsdArgs({ host, port, waitUntilDebuggerAttaches });
                    return [debugFactory.getPtvsdPath(), ...args];
                }

                return new RemoteDebuggerExternalLauncherScriptProvider().getLauncherArgs({
                    host,
                    port,
                    waitUntilDebuggerAttaches
                });
            }
        }
    };
}
