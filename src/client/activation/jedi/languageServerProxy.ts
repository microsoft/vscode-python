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
import { IExperimentsManager, IInterpreterPathService, Resource } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import { swallowExceptions } from '../../common/utils/decorators';
import { noop } from '../../common/utils/misc';
import { LanguageServerSymbolProvider } from '../../providers/symbolProvider';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITestingService } from '../../testing/types';
import { FileBasedCancellationStrategy } from '../common/cancellationUtils';
import { LanguageClientMiddleware } from '../languageClientMiddleware';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerProxy } from '../types';

@injectable()
export class JediLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;

    private startupCompleted: Deferred<void>;

    private cancellationStrategy: FileBasedCancellationStrategy | undefined;

    private readonly disposables: Disposable[] = [];

    private disposed = false;

    private lsVersion: string | undefined;

    constructor(
        @inject(ILanguageClientFactory) private readonly factory: ILanguageClientFactory,
        @inject(ITestingService) private readonly testManager: ITestingService,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
    ) {
        this.startupCompleted = createDeferred<void>();
    }

    private static versionTelemetryProps(instance: JediLanguageServerProxy) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    @traceDecorators.verbose('Stopping language server')
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

    @traceDecorators.error('Failed to start language server')
    @captureTelemetry(
        EventName.JEDI_LANGUAGE_SERVER_ENABLED,
        undefined,
        true,
        undefined,
        JediLanguageServerProxy.versionTelemetryProps,
    )
    public async start(
        resource: Resource,
        interpreter: PythonEnvironment | undefined,
        options: LanguageClientOptions,
    ): Promise<void> {
        if (!this.languageClient) {
            this.lsVersion =
                (options.middleware ? (<LanguageClientMiddleware>options.middleware).serverVersion : undefined) ??
                '0.19.3';

            this.cancellationStrategy = new FileBasedCancellationStrategy();
            options.connectionOptions = { cancellationStrategy: this.cancellationStrategy };

            this.languageClient = await this.factory.createLanguageClient(resource, interpreter, options);

            this.languageClient.onDidChangeState((e) => {
                // The client's on* methods must be called after the client has started, but if called too
                // late the server may have already sent a message (which leads to failures). Register
                // these on the state change to running to ensure they are ready soon enough.
                if (e.newState === State.Running) {
                    this.registerHandlers();
                }
            });

            this.disposables.push(this.languageClient.start());
            await this.serverReady();

            if (this.disposed) {
                // Check if it got disposed in the interim.
                return;
            }

            await this.registerTestServices();
        } else {
            await this.startupCompleted.promise;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public loadExtension(): void {
        // No body.
    }

    @captureTelemetry(
        EventName.JEDI_LANGUAGE_SERVER_READY,
        undefined,
        true,
        undefined,
        JediLanguageServerProxy.versionTelemetryProps,
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

    @swallowExceptions('Activating Unit Tests Manager for Jedi language server')
    protected async registerTestServices(): Promise<void> {
        if (!this.languageClient) {
            throw new Error('languageClient not initialized');
        }
        await this.testManager.activate(new LanguageServerSymbolProvider(this.languageClient));
    }

    private registerHandlers() {
        if (this.disposed) {
            // Check if it got disposed in the interim.
            return;
        }

        const progressReporting = new ProgressReporting(this.languageClient!);
        this.disposables.push(progressReporting);

        if (this.experiments.inExperiment(DeprecatePythonPath.experiment)) {
            this.disposables.push(
                this.interpreterPathService.onDidChange(() => {
                    // Manually send didChangeConfiguration in order to get the server to re-query
                    // the workspace configurations (to then pick up pythonPath set in the middleware).
                    // This is needed as interpreter changes via the interpreter path service happen
                    // outside of VS Code's settings (which would mean VS Code sends the config updates itself).
                    this.languageClient!.sendNotification(DidChangeConfigurationNotification.type, {
                        settings: null,
                    });
                }),
            );
        }
    }
}
