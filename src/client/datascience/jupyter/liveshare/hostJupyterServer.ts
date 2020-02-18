// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as os from 'os';
import * as vscode from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { nbformat } from '@jupyterlab/coreutils';
import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../../common/application/types';
import { traceInfo } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, Resource } from '../../../common/types';
import * as localize from '../../../common/utils/localize';
import { IInterpreterService } from '../../../interpreter/contracts';
import { Identifiers, LiveShare, LiveShareCommands, RegExpValues } from '../../constants';
import {
    IDataScience,
    IJupyterSession,
    IJupyterSessionManager,
    IJupyterSessionManagerFactory,
    INotebook,
    INotebookExecutionLogger,
    INotebookServer,
    INotebookServerLaunchInfo
} from '../../types';
import { JupyterServerBase } from '../jupyterServer';
import { KernelSelector } from '../kernels/kernelSelector';
import { HostJupyterNotebook } from './hostJupyterNotebook';
import { LiveShareParticipantHost } from './liveShareParticipantMixin';
import { IRoleBasedObject } from './roleBasedFactory';

// tslint:disable-next-line: no-require-imports
// tslint:disable:no-any

export class HostJupyterServer extends LiveShareParticipantHost(JupyterServerBase, LiveShare.JupyterServerSharedService)
    implements IRoleBasedObject, INotebookServer {
    private disposed = false;
    private portToForward = 0;
    private sharedPort: vscode.Disposable | undefined;
    constructor(
        private liveShare: ILiveShareApi,
        _dataScience: IDataScience,
        asyncRegistry: IAsyncDisposableRegistry,
        disposableRegistry: IDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManagerFactory,
        private workspaceService: IWorkspaceService,
        loggers: INotebookExecutionLogger[],
        private appService: IApplicationShell,
        private fs: IFileSystem,
        private readonly kernelSelector: KernelSelector,
        private readonly interpreterService: IInterpreterService
    ) {
        super(liveShare, asyncRegistry, disposableRegistry, configService, sessionManager, loggers);
    }

    public async dispose(): Promise<void> {
        if (!this.disposed) {
            this.disposed = true;
            await super.dispose();
            const api = await this.api;
            return this.onDetach(api);
        }
    }

    public async connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void> {
        if (launchInfo.connectionInfo && launchInfo.connectionInfo.localLaunch) {
            const portMatch = RegExpValues.ExtractPortRegex.exec(launchInfo.connectionInfo.baseUrl);
            if (portMatch && portMatch.length > 1) {
                const port = parseInt(portMatch[1], 10);
                await this.attemptToForwardPort(this.finishedApi, port);
            }
        }
        return super.connect(launchInfo, cancelToken);
    }

    public async onAttach(api: vsls.LiveShare | null): Promise<void> {
        await super.onAttach(api);

        if (api && !this.disposed) {
            const service = await this.waitForService();

            // Attach event handlers to different requests
            if (service) {
                // Requests return arrays
                service.onRequest(LiveShareCommands.syncRequest, (_args: any[], _cancellation: CancellationToken) =>
                    this.onSync()
                );
                service.onRequest(LiveShareCommands.disposeServer, (_args: any[], _cancellation: CancellationToken) =>
                    this.dispose()
                );
                service.onRequest(
                    LiveShareCommands.createNotebook,
                    async (args: any[], cancellation: CancellationToken) => {
                        const resource = this.parseUri(args[0]);
                        const identity = this.parseUri(args[1]);
                        // Don't return the notebook. We don't want it to be serialized. We just want its live share server to be started.
                        const notebook = (await this.createNotebook(
                            resource,
                            identity!,
                            undefined,
                            cancellation
                        )) as HostJupyterNotebook;
                        await notebook.onAttach(api);
                    }
                );

                // See if we need to forward the port
                await this.attemptToForwardPort(api, this.portToForward);
            }
        }
    }

    public async onSessionChange(api: vsls.LiveShare | null): Promise<void> {
        await super.onSessionChange(api);

        this.getNotebooks().forEach(async notebook => {
            const hostNotebook = notebook as HostJupyterNotebook;
            if (hostNotebook) {
                await hostNotebook.onSessionChange(api);
            }
        });
    }

    public async onDetach(api: vsls.LiveShare | null): Promise<void> {
        await super.onDetach(api);

        // Make sure to unshare our port
        if (api && this.sharedPort) {
            this.sharedPort.dispose();
            this.sharedPort = undefined;
        }
    }

    public async waitForServiceName(): Promise<string> {
        // First wait for connect to occur
        const launchInfo = await this.waitForConnect();

        // Use our base name plus our purpose. This means one unique server per purpose
        if (!launchInfo) {
            return LiveShare.JupyterServerSharedService;
        }
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Should there be some separator in the name?
        return `${LiveShare.JupyterServerSharedService}${launchInfo.purpose}`;
    }

    protected async createNotebookInstance(
        resource: Resource,
        identity: vscode.Uri,
        sessionManager: IJupyterSessionManager,
        possibleSession: IJupyterSession | undefined,
        disposableRegistry: IDisposableRegistry,
        configService: IConfigurationService,
        loggers: INotebookExecutionLogger[],
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook> {
        // See if already exists.
        const existing = await this.getNotebook(identity);
        if (existing) {
            // Dispose the possible session as we don't need it
            if (possibleSession) {
                await possibleSession.dispose();
            }

            // Then we can return the existing notebook.
            return existing;
        }

        // Compute launch information from the resource and the notebook metadata
        const { info, changedKernel } = await this.computeLaunchInfo(
            resource,
            sessionManager,
            notebookMetadata,
            cancelToken
        );

        // If we switched kernels, try switching the possible session
        if (changedKernel && possibleSession && info.kernelSpec) {
            await possibleSession.changeKernel(
                info.kernelSpec,
                this.configService.getSettings(resource).datascience.jupyterLaunchTimeout
            );
        }

        // Start a session (or use the existing one)
        const session = possibleSession || (await sessionManager.startNew(info.kernelSpec, cancelToken));
        traceInfo(`Started session ${this.id}`);

        if (session) {
            // Create our notebook
            const notebook = new HostJupyterNotebook(
                this.liveShare,
                session,
                configService,
                disposableRegistry,
                this,
                info,
                loggers,
                resource,
                identity,
                this.getDisposedError.bind(this),
                this.workspaceService,
                this.appService,
                this.fs
            );

            // Wait for it to be ready
            traceInfo(`Waiting for idle (session) ${this.id}`);
            const idleTimeout = configService.getSettings().datascience.jupyterLaunchTimeout;
            await notebook.waitForIdle(idleTimeout);

            // Run initial setup
            await notebook.initialize(cancelToken);

            traceInfo(`Finished connecting ${this.id}`);

            // Save the notebook
            this.setNotebook(identity, notebook);

            // Return the result.
            return notebook;
        }

        throw this.getDisposedError();
    }

    private async computeLaunchInfo(
        resource: Resource,
        sessionManager: IJupyterSessionManager,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<{ info: INotebookServerLaunchInfo; changedKernel: boolean }> {
        // First we need our launch information so we can start a new session (that's what our notebook is really)
        let launchInfo = await this.waitForConnect();
        if (!launchInfo) {
            throw this.getDisposedError();
        }
        // Create a copy of launch info, cuz we're modifying it here.
        // This launch info contains the server connection info (that could be shared across other nbs).
        // However the kernel info is different. The kernel info is stored as a  property of this, hence create a separate instance for each nb.
        launchInfo = {
            ...launchInfo
        };

        // Determine the interpreter for our resource. If different, we need a different kernel.
        const resourceInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        // Find a kernel that can be used.
        // Do this only if kernel information has been provided in the metadata, or the resource's interpreter is different.
        let changedKernel = false;
        if (notebookMetadata?.kernelspec || resourceInterpreter?.displayName !== launchInfo.interpreter?.displayName) {
            const kernelInfo = await (launchInfo.connectionInfo.localLaunch
                ? this.kernelSelector.getKernelForLocalConnection(
                      resource,
                      sessionManager,
                      notebookMetadata,
                      false,
                      cancelToken
                  )
                : this.kernelSelector.getKernelForRemoteConnection(
                      resource,
                      sessionManager,
                      notebookMetadata,
                      cancelToken
                  ));

            const kernelInfoToUse = kernelInfo?.kernelSpec || kernelInfo?.kernelModel;
            if (kernelInfoToUse) {
                launchInfo.kernelSpec = kernelInfoToUse;
                changedKernel = true;
            }
        }

        return { info: launchInfo, changedKernel };
    }

    private parseUri(uri: string | undefined): Resource {
        const parsed = uri ? vscode.Uri.parse(uri) : undefined;
        return parsed &&
            parsed.scheme &&
            parsed.scheme !== Identifiers.InteractiveWindowIdentityScheme &&
            parsed.scheme === 'vsls'
            ? this.finishedApi!.convertSharedUriToLocal(parsed)
            : parsed;
    }

    private async attemptToForwardPort(api: vsls.LiveShare | null | undefined, port: number): Promise<void> {
        if (port !== 0 && api && api.session && api.session.role === vsls.Role.Host) {
            this.portToForward = 0;
            this.sharedPort = await api.shareServer({
                port,
                displayName: localize.DataScience.liveShareHostFormat().format(os.hostname())
            });
        } else {
            this.portToForward = port;
        }
    }

    private onSync(): Promise<any> {
        return Promise.resolve(true);
    }
}
