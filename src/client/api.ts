// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugAdapterDescriptorFactory as DebugAdapterExperiment } from './common/experimentGroups';
import { traceError } from './common/logger';
import { IConfigurationService, IExperimentsManager } from './common/types';
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

// tslint:disable-next-line:no-any
export function buildApi(ready: Promise<any>, experimentsManager: IExperimentsManager, debugFactory: IDebugAdapterDescriptorFactory, configuration: IConfigurationService) {
    return {
        // 'ready' will propogate the exception, but we must log it here first.
        ready: ready.catch((ex) => {
            traceError('Failure during activation.', ex);
            return Promise.reject(ex);
        }),
        debug: {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Add support for ptvsd wheels experiment, see https://github.com/microsoft/vscode-python/issues/7549
            async getRemoteLauncherCommand(host: string, port: number, waitUntilDebuggerAttaches: boolean = true): Promise<string[]> {
                const pythonSettings = configuration.getSettings();

                if (experimentsManager.inExperiment(DebugAdapterExperiment.experiment) && (await debugFactory.useNewPtvsd(pythonSettings.pythonPath))) {
                    const waitArgs = waitUntilDebuggerAttaches ? ['--wait'] : [];
                    return [await debugFactory.getPtvsdPath(pythonSettings.pythonPath), '--default', '--host', host, '--port', port.toString(), ...waitArgs];
                } else {
                return new RemoteDebuggerExternalLauncherScriptProvider().getLauncherArgs({ host, port, waitUntilDebuggerAttaches });
            }
        }
        }
    };
}
