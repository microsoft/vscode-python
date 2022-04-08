// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import {
    DidChangeConfigurationNotification,
    Disposable,
    LanguageClient,
    LanguageClientOptions,
    State,
} from 'vscode-languageclient/node';

import { IExperimentService, IExtensions, IInterpreterPathService, Resource } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { FileBasedCancellationStrategy } from '../common/cancellationUtils';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerProxy } from '../types';
import { traceDecoratorError, traceDecoratorVerbose, traceError } from '../../logging';
import { IWorkspaceService } from '../../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace InExperiment {
    export const Method = 'python/inExperiment';

    export interface IRequest {
        experimentName: string;
    }

    export interface IResponse {
        inExperiment: boolean;
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace GetExperimentValue {
    export const Method = 'python/getExperimentValue';

    export interface IRequest {
        experimentName: string;
    }

    export interface IResponse<T extends boolean | number | string> {
        value: T | undefined;
    }
}

export class NodeLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;

    private startupCompleted: Deferred<void>;

    private cancellationStrategy: FileBasedCancellationStrategy | undefined;

    private readonly disposables: Disposable[] = [];

    private disposed = false;

    private lsVersion: string | undefined;

    constructor(
        private readonly factory: ILanguageClientFactory,
        private readonly experimentService: IExperimentService,
        private readonly interpreterPathService: IInterpreterPathService,
        private readonly environmentService: IEnvironmentVariablesProvider,
        private readonly workspace: IWorkspaceService,
        private readonly extensions: IExtensions,
    ) {
        this.startupCompleted = createDeferred<void>();
    }

    private static versionTelemetryProps(instance: NodeLanguageServerProxy) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    @traceDecoratorVerbose('Stopping language server')
    public dispose(): void {
        if (this.languageClient) {
            // Do not await on this.
            this.languageClient.stop().then(noop, (ex) => traceError('Stopping language client failed', ex));
            this.languageClient = undefined;
        }
        if (this.cancellationStrategy) {
            this.cancellationStrategy.dispose();
            this.cancellationStrategy = undefined;
        }
        while (this.disposables.length > 0) {
            const d = this.disposables.shift()!;
            d.dispose();
        }
        if (this.startupCompleted.completed) {
            this.startupCompleted.reject(new Error('Disposed language server'));
            this.startupCompleted = createDeferred<void>();
        }
        this.disposed = true;
    }

    @traceDecoratorError('Failed to start language server')
    @captureTelemetry(
        EventName.LANGUAGE_SERVER_ENABLED,
        undefined,
        true,
        undefined,
        NodeLanguageServerProxy.versionTelemetryProps,
    )
    public async start(
        resource: Resource,
        interpreter: PythonEnvironment | undefined,
        options: LanguageClientOptions,
    ): Promise<void> {
        if (!this.languageClient) {
            const extension = this.extensions.getExtension(PYLANCE_EXTENSION_ID);
            this.lsVersion = extension?.packageJSON.version || '0';

            this.cancellationStrategy = new FileBasedCancellationStrategy();
            options.connectionOptions = { cancellationStrategy: this.cancellationStrategy };

            this.languageClient = await this.factory.createLanguageClient(resource, interpreter, options);

            this.languageClient.onDidChangeState((e) => {
                // The client's on* methods must be called after the client has started, but if called too
                // late the server may have already sent a message (which leads to failures). Register
                // these on the state change to running to ensure they are ready soon enough.
                if (e.newState === State.Running) {
                    this.registerHandlers(resource);
                }
            });

            this.disposables.push(
                this.workspace.onDidGrantWorkspaceTrust(() => {
                    this.languageClient!.onReady().then(() => {
                        this.languageClient!.sendNotification('python/workspaceTrusted', { isTrusted: true });
                    });
                }),
            );

            this.disposables.push(this.languageClient.start());
            await this.serverReady();

            if (this.disposed) {
                // Check if it got disposed in the interim.
            }
        } else {
            await this.startupCompleted.promise;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public loadExtension(): void {
        // No body.
    }

    @captureTelemetry(
        EventName.LANGUAGE_SERVER_READY,
        undefined,
        true,
        undefined,
        NodeLanguageServerProxy.versionTelemetryProps,
    )
    protected async serverReady(): Promise<void> {
        while (this.languageClient && !this.languageClient.initializeResult) {
            await sleep(100);
        }
        if (this.languageClient) {
            await this.languageClient.onReady();
        }
        this.startupCompleted.resolve();
    }

    private registerHandlers(_resource: Resource) {
        if (this.disposed) {
            // Check if it got disposed in the interim.
            return;
        }

        const progressReporting = new ProgressReporting(this.languageClient!);
        this.disposables.push(progressReporting);

        this.disposables.push(
            this.interpreterPathService.onDidChange(() => {
                // Manually send didChangeConfiguration in order to get the server to requery
                // the workspace configurations (to then pick up pythonPath set in the middleware).
                // This is needed as interpreter changes via the interpreter path service happen
                // outside of VS Code's settings (which would mean VS Code sends the config updates itself).
                this.languageClient!.sendNotification(DidChangeConfigurationNotification.type, {
                    settings: null,
                });
            }),
        );
        this.disposables.push(
            this.environmentService.onDidEnvironmentVariablesChange(() => {
                this.languageClient!.sendNotification(DidChangeConfigurationNotification.type, {
                    settings: null,
                });
            }),
        );

        this.languageClient!.onRequest(
            InExperiment.Method,
            async (params: InExperiment.IRequest): Promise<InExperiment.IResponse> => {
                const inExperiment = await this.experimentService.inExperiment(params.experimentName);
                return { inExperiment };
            },
        );

        this.languageClient!.onRequest(
            GetExperimentValue.Method,
            async <T extends boolean | number | string>(
                params: GetExperimentValue.IRequest,
            ): Promise<GetExperimentValue.IResponse<T>> => {
                const value = await this.experimentService.getExperimentValue<T>(params.experimentName);
                return { value };
            },
        );

        this.disposables.push(
            this.languageClient!.onRequest('python/isTrustedWorkspace', async () => ({
                isTrusted: this.workspace.isTrusted,
            })),
        );
    }
}
