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

import { ChildProcess } from 'child_process';
import { DeprecatePythonPath } from '../../common/experiments/groups';
import { traceDecorators, traceError } from '../../common/logger';
import {
    IConfigurationService,
    IExperimentsManager,
    IInterpreterPathService,
    IPythonSettings,
    Resource,
} from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { LanguageServerSymbolProvider } from '../../providers/symbolProvider';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITestingService } from '../../testing/types';
import { FileBasedCancellationStrategy } from '../common/cancellationUtils';
import { LanguageClientMiddleware } from '../languageClientMiddleware';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerProxy } from '../types';
import { StopWatch } from '../../common/utils/stopWatch';
import { getMemoryUsage } from '../../common/process/memory';
import { killPidTree } from '../../common/process/rawProcessApis';

@injectable()
export class JediLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;

    private cancellationStrategy: FileBasedCancellationStrategy | undefined;

    private readonly disposables: Disposable[] = [];

    private disposed = false;

    private lsVersion: string | undefined;

    private pidUsageFailures = { timer: new StopWatch(), counter: 0 };

    private pythonSettings: IPythonSettings | undefined;

    private timer?: NodeJS.Timer | number;

    constructor(
        @inject(ILanguageClientFactory) private readonly factory: ILanguageClientFactory,
        @inject(ITestingService) private readonly testManager: ITestingService,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    ) {}

    private static versionTelemetryProps(instance: JediLanguageServerProxy) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    @traceDecorators.verbose('Stopping language server')
    public dispose(): void {
        if (this.languageClient) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pid: number | undefined = ((this.languageClient as any)._serverProcess as ChildProcess)?.pid;
            const killServer = () => {
                if (pid) {
                    killPidTree(pid);
                }
            };
            // Do not await on this.
            this.languageClient.stop().then(
                () => killServer(),
                (ex) => {
                    traceError('Stopping language client failed', ex);
                    killServer();
                },
            );
            this.languageClient = undefined;
        }

        if (this.cancellationStrategy) {
            this.cancellationStrategy.dispose();
            this.cancellationStrategy = undefined;
        }

        if (this.timer) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            clearTimeout(this.timer as any);
        }

        while (this.disposables.length > 0) {
            const d = this.disposables.shift()!;
            d.dispose();
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
        if (this.languageClient) {
            return this.serverReady();
        }

        this.pythonSettings = this.configurationService.getSettings(resource);

        this.lsVersion =
            (options.middleware ? (<LanguageClientMiddleware>options.middleware).serverVersion : undefined) ?? '0.19.3';

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
            return Promise.resolve();
        }

        await this.registerTestServices();

        try {
            await this.checkJediLSPMemoryFootprint();
        } catch (ex) {
            // Ignore errors
        }

        return Promise.resolve();
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
        if (this.languageClient) {
            await this.languageClient.onReady();
        }
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

    private async checkJediLSPMemoryFootprint() {
        // Check memory footprint periodically. Do not check on every request due to
        // the performance impact. See https://github.com/soyuka/pidusage - on Windows
        // it is using wmic which means spawning cmd.exe process on every request.
        if (this.pythonSettings && this.pythonSettings.jediMemoryLimit === -1) {
            return;
        }

        await this.sendJediMemoryTelemetry();
        if (this.timer) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            clearTimeout(this.timer as any);
        }
        this.timer = setTimeout(() => this.checkJediLSPMemoryFootprint(), 15 * 1000);
    }

    private async sendJediMemoryTelemetry(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proc: ChildProcess | undefined = (this.languageClient as any)._serverProcess as ChildProcess;
        if (
            !proc ||
            proc.killed ||
            this.pidUsageFailures.counter > 2 ||
            !this.pythonSettings ||
            this.pythonSettings.jediMemoryLimit === -1
        ) {
            return;
        }

        try {
            const memory = await getMemoryUsage(proc.pid);
            const limit = Math.min(Math.max(this.pythonSettings.jediMemoryLimit, 3072), 8192) * 1024 * 1024;
            if (memory > 0) {
                const props = {
                    memUse: memory,
                    limit,
                    isUserDefinedLimit: limit !== 1024,
                    restart: false,
                };
                sendTelemetryEvent(EventName.JEDI_MEMORY, undefined, props);
            }
        } catch (err) {
            this.pidUsageFailures.counter += 1;
            // If this function fails 2 times in the last 60 seconds, lets not try ever again.
            if (this.pidUsageFailures.timer.elapsedTime > 60 * 1000) {
                this.pidUsageFailures.counter = 0;
                this.pidUsageFailures.timer.reset();
            }
            traceError('Python Extension: (pidusage-tree)', err);
        }
    }
}
