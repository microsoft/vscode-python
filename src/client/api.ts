// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { isTestExecution } from './common/constants';
import { traceError } from './common/logger';
import { IConfigurationService, Resource } from './common/types';
import { IDataViewerDataProvider, IDataViewerFactory } from './datascience/data-viewing/types';
import { getDebugpyLauncherArgs, getDebugpyPackagePath } from './debugger/extension/adapter/remoteLaunchers';
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

        /**
         * Gets the path to the debugger package used by the extension.
         * @returns {Promise<string>}
         */
        getDebuggerPackagePath(): Promise<string | undefined>;
    };
    /**
     * Return internal settings within the extension which are stored in VSCode storage
     */
    settings: {
        /**
         * Returns the Python execution command corresponding to the specified resource, taking into account
         * any workspace-specific settings for the workspace to which this resource belongs.
         * E.g of execution commands returned could be,
         * * `['<path to the interpreter set in settings>']`
         * * `['<path to the interpreter selected by the extension when setting is not set>']`
         * * `['conda', 'run', 'python']` which is used to run from within Conda environments.
         * or something similar for some other Python environments.
         * @param {Resource} [resource] A resource for which the setting is asked for.
         * * When no resource is provided, the setting scoped to the first workspace folder is returned.
         * * If no folder is present, it returns the global setting.
         * @returns {(string[] | undefined)} When return value is `undefined`, it means no interpreter is set.
         * Otherwise, join the items returned using space to construct the full execution command.
         */
        getExecutionCommand(resource?: Resource): string[] | undefined;
    };
    datascience: {
        /**
         * Launches Data Viewer component.
         * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
         * @param {string} title Data Viewer title
         */
        showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
    };
}

export function buildApi(
    // tslint:disable-next-line:no-any
    ready: Promise<any>,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
): IExtensionApi {
    const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
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
                return getDebugpyLauncherArgs({
                    host,
                    port,
                    waitUntilDebuggerAttaches
                });
            },
            async getDebuggerPackagePath(): Promise<string | undefined> {
                return getDebugpyPackagePath();
            }
        },
        settings: {
            getExecutionCommand(resource?: Resource) {
                const pythonPath = configurationService.getSettings(resource).pythonPath;
                // If pythonPath equals an empty string, no interpreter is set.
                return pythonPath === '' ? undefined : [pythonPath];
            }
        },
        datascience: {
            async showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void> {
                const dataViewerProviderService = serviceContainer.get<IDataViewerFactory>(IDataViewerFactory);
                await dataViewerProviderService.create(dataProvider, title);
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
