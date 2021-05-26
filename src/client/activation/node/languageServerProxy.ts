// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import {
    DidChangeConfigurationNotification,
    Disposable,
    LanguageClient,
    LanguageClientOptions,
    State,
} from 'vscode-languageclient/node';

import { DeprecatePythonPath } from '../../common/experiments/groups';
import { traceDecorators, traceError } from '../../common/logger';
import { IConfigurationService, IExperimentService, IInterpreterPathService, Resource } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { FileBasedCancellationStrategy } from '../common/cancellationUtils';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerFolderService, ILanguageServerProxy } from '../types';

namespace InExperiment {
    export const Method = 'python/inExperiment';

    export interface IRequest {
        experimentName: string;
    }

    export interface IResponse {
        inExperiment: boolean;
    }
}

namespace GetExperimentValue {
    export const Method = 'python/getExperimentValue';

    export interface IRequest {
        experimentName: string;
    }

    export interface IResponse<T extends boolean | number | string> {
        value: T | undefined;
    }
}

@injectable()
export class NodeLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;
    private startupCompleted: Deferred<void>;
    private cancellationStrategy: FileBasedCancellationStrategy | undefined;
    private readonly disposables: Disposable[] = [];
    private disposed: boolean = false;
    private lsVersion: string | undefined;

    constructor(
        @inject(ILanguageClientFactory) private readonly factory: ILanguageClientFactory,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(ILanguageServerFolderService) private readonly folderService: ILanguageServerFolderService,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
        @inject(IEnvironmentVariablesProvider) private readonly environmentService: IEnvironmentVariablesProvider,
    ) {
        this.startupCompleted = createDeferred<void>();
    }

    private static versionTelemetryProps(instance: NodeLanguageServerProxy) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    @traceDecorators.verbose('Stopping language server')
    public dispose() {
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

    @traceDecorators.error('Failed to start language server')
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
            const directory = await this.folderService.getCurrentLanguageServerDirectory();
            this.lsVersion = directory?.version.format();

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

            this.disposables.push(this.languageClient.start());
            await this.serverReady();

            if (this.disposed) {
                // Check if it got disposed in the interim.
                return;
            }
        } else {
            await this.startupCompleted.promise;
        }
    }

    public loadExtension(_args?: {}) {}

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

    private registerHandlers(resource: Resource) {
        if (this.disposed) {
            // Check if it got disposed in the interim.
            return;
        }

        const progressReporting = new ProgressReporting(this.languageClient!);
        this.disposables.push(progressReporting);

        if (this.experimentService.inExperimentSync(DeprecatePythonPath.experiment)) {
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
        }

        this.disposables.push(
            this.environmentService.onDidEnvironmentVariablesChange(() => {
                this.languageClient!.sendNotification(DidChangeConfigurationNotification.type, {
                    settings: null,
                });
            }),
        );

        const settings = this.configurationService.getSettings(resource);
        if (settings.downloadLanguageServer) {
            this.languageClient!.onTelemetry((telemetryEvent) => {
                const eventName = telemetryEvent.EventName || EventName.LANGUAGE_SERVER_TELEMETRY;
                const formattedProperties = {
                    ...telemetryEvent.Properties,
                    // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
                    method: telemetryEvent.Properties.method?.replace(/\//g, '.'),
                };
                sendTelemetryEvent(
                    eventName,
                    telemetryEvent.Measurements,
                    formattedProperties,
                    telemetryEvent.Exception,
                );
            });
        }

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
    }
}
