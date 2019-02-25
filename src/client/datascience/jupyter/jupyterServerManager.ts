// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';

import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IAsyncDisposable, IAsyncDisposableRegistry, IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IInterpreterService } from '../../interpreter/contracts';
import { Settings } from '../constants';
import { IJupyterExecution, INotebookServer, INotebookServerManager, IStatusProvider } from '../types';

interface ILaunchParameters {
    serverURI: string | undefined;
    workingDir: string | undefined;
    darkTheme : boolean;
    useDefaultConfig : boolean;
}

@injectable()
export class JupyterServerManager implements INotebookServerManager, IAsyncDisposable {
    // Currently coding this as just a single server instance.
    // It's encapsulated here so we can add support for multiple servers as needed pretty easily
    private activeServer: INotebookServer | undefined;

    constructor(
        @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IStatusProvider) private statusProvider: IStatusProvider,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService) {
        this.asyncRegistry.push(this);
    }

    // Either return our current active server or create a new one from our settings if needed
    public async getOrCreateServer(): Promise<INotebookServer | undefined> {
        // Find the settings that we are going to launch our server with
        const launchParameters = await this.getLaunchParameters();
        if (await this.isActiveServer(launchParameters)) {
            // If we already have a server of these settings, just return it
            return this.activeServer;
        } else {
            // If not shutdown the old server and start up a new one
            if (this.activeServer) {
                await this.activeServer.dispose();
                this.activeServer = undefined;
            }

            const status = this.statusProvider.set(localize.DataScience.connectingToJupyter());

            try {
                this.activeServer = await this.jupyterExecution.connectToNotebookServer(
                    launchParameters.serverURI,
                    launchParameters.darkTheme,
                    launchParameters.useDefaultConfig,
                    undefined,
                    launchParameters.workingDir);

                return this.activeServer;
            } finally {
                if (status) {
                    status.dispose();
                }
            }
        }
    }

    public async getServer() : Promise<INotebookServer | undefined> {
        // Compute launch parameters.
        const launchParameters = await this.getLaunchParameters();

        if (await this.isActiveServer(launchParameters)) {
            // If we already have a server of these settings, just return it
            return this.activeServer;
        }
    }

    // Don't check the launch paramters, just return back the active
    // used for components that never create or control the active server like the variables view
    public getActiveServer(): INotebookServer | undefined {
        return this.activeServer;
    }

    public dispose(): Promise<void> {
        if (this.activeServer) {
            return this.activeServer.dispose();
        } else {
            return Promise.resolve();
        }
    }

    private async getLaunchParameters() : Promise<ILaunchParameters> {
        // Find the settings that we are going to launch our server with
        const settings = this.configuration.getSettings();
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        let workingDir: string | undefined;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;
        // Check for dark theme, if so set matplot lib to use dark_background settings
        let darkTheme: boolean = false;
        const workbench = this.workspaceService.getConfiguration('workbench');
        if (workbench) {
            const theme = workbench.get<string>('colorTheme');
            if (theme) {
                darkTheme = /dark/i.test(theme);
            }
        }

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;

            workingDir = await this.calculateWorkingDirectory();
        }

        return {
            serverURI,
            workingDir,
            useDefaultConfig,
            darkTheme
        };
    }

    // Given our launch parameters, is this server already the active server?
    private async isActiveServer(launchParameters: ILaunchParameters): Promise<boolean> {
        if (!this.activeServer || !this.activeServer.getLaunchInfo()) {
            return false;
        }

        const launchInfo = this.activeServer.getLaunchInfo();

        // Check here to see if we have the same settings as a server that we already have running
        // Note: we are not looking at the kernel spec here this saves us from having to enumerate
        // kernel specs when looking for a similar server, instead we just look if the interpreter is different
        // however this could mean that if you add a new kernel spec while a server is running then we won't
        // detect that launch could give you a different server in that case
        // ! ok as we have already exited if get launch info is undefined
        if (launchInfo!.uri === launchParameters.serverURI && launchInfo!.usingDarkTheme ===  launchParameters.darkTheme
            && launchInfo!.workingDir ===  launchParameters.workingDir) {
            const info = await this.interpreterService.getActiveInterpreter();
            if (info === launchInfo!.currentInterpreter) {
                return true;
            }
        }

        return false;
    }

    // Calculate the working directory that we should move into when starting up our Jupyter server locally
    private async calculateWorkingDirectory(): Promise<string | undefined> {
        let workingDir: string | undefined;
        // For a local launch calculate the working directory that we should switch into
        const settings = this.configuration.getSettings();
        const fileRoot = settings.datascience.notebookFileRoot;

        // If we don't have a workspace open the notebookFileRoot seems to often have a random location in it (we use ${workspaceRoot} as default)
        // so only do this setting if we actually have a valid workspace open
        if (fileRoot && this.workspaceService.hasWorkspaceFolders) {
            const workspaceFolderPath = this.workspaceService.workspaceFolders![0].uri.fsPath;
            if (path.isAbsolute(fileRoot)) {
                if (await this.fileSystem.directoryExists(fileRoot)) {
                    // User setting is absolute and exists, use it
                    workingDir = fileRoot;
                } else {
                    // User setting is absolute and doesn't exist, use workspace
                    workingDir = workspaceFolderPath;
                }
            } else {
                // fileRoot is a relative path, combine it with the workspace folder
                const combinedPath = path.join(workspaceFolderPath, fileRoot);
                if (await this.fileSystem.directoryExists(combinedPath)) {
                    // combined path exists, use it
                    workingDir = combinedPath;
                } else {
                    // Combined path doesn't exist, use workspace
                    workingDir = workspaceFolderPath;
                }
            }
        }
        return workingDir;
    }
}
