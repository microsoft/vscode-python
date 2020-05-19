// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { Disposable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient';

import { traceDecorators, traceError } from '../../common/logger';
import { IConfigurationService, Resource } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import { swallowExceptions } from '../../common/utils/decorators';
import { noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../interpreter/contracts';
import { LanguageServerSymbolProvider } from '../../providers/symbolProvider';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ITestManagementService } from '../../testing/types';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerProxy } from '../types';

@injectable()
export class DotNetLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;
    private startupCompleted: Deferred<void>;
    private readonly disposables: Disposable[] = [];
    private extensionLoadedArgs = new Set<{}>();
    private disposed: boolean = false;

    constructor(
        @inject(ILanguageClientFactory) private readonly factory: ILanguageClientFactory,
        @inject(ITestManagementService) private readonly testManager: ITestManagementService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService
    ) {
        this.startupCompleted = createDeferred<void>();
    }
    @traceDecorators.verbose('Stopping Language Server')
    public dispose() {
        if (this.languageClient) {
            // Do not await on this.
            this.languageClient.stop().then(noop, (ex) => traceError('Stopping language client failed', ex));
            this.languageClient = undefined;
        }
        while (this.disposables.length > 0) {
            const d = this.disposables.shift()!;
            d.dispose();
        }
        if (this.startupCompleted.completed) {
            this.startupCompleted.reject(new Error('Disposed Language Server'));
            this.startupCompleted = createDeferred<void>();
        }
        this.disposed = true;
    }

    @traceDecorators.error('Failed to start language server')
    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_ENABLED, undefined, true)
    public async start(
        resource: Resource,
        interpreter: PythonInterpreter | undefined,
        options: LanguageClientOptions
    ): Promise<void> {
        if (!this.languageClient) {
            this.languageClient = await this.factory.createLanguageClient(resource, interpreter, options);
            this.disposables.push(this.languageClient!.start());
            await this.serverReady();
            if (this.disposed) {
                // Check if it got disposed in the interim.
                return;
            }
            const progressReporting = new ProgressReporting(this.languageClient!);
            this.disposables.push(progressReporting);

            const settings = this.configurationService.getSettings(resource);
            if (settings.downloadLanguageServer) {
                this.languageClient.onTelemetry((telemetryEvent) => {
                    const eventName = telemetryEvent.EventName || EventName.PYTHON_LANGUAGE_SERVER_TELEMETRY;
                    const formattedProperties = {
                        ...telemetryEvent.Properties,
                        // Replace all slashes in the method name so it doesn't get scrubbed by vscode-extension-telemetry.
                        method: telemetryEvent.Properties.method?.replace(/\//g, '.')
                    };
                    sendTelemetryEvent(eventName, telemetryEvent.Measurements, formattedProperties);
                });
            }
            await this.registerTestServices();
        } else {
            await this.startupCompleted.promise;
        }
    }
    @traceDecorators.error('Failed to load Language Server extension')
    public loadExtension(args?: {}) {
        if (this.extensionLoadedArgs.has(args || '')) {
            return;
        }
        this.extensionLoadedArgs.add(args || '');
        this.startupCompleted.promise
            .then(() =>
                this.languageClient!.sendRequest('python/loadExtension', args).then(noop, (ex) =>
                    traceError('Request python/loadExtension failed', ex)
                )
            )
            .ignoreErrors();
    }
    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_READY, undefined, true)
    protected async serverReady(): Promise<void> {
        while (this.languageClient && !this.languageClient!.initializeResult) {
            await sleep(100);
        }
        this.startupCompleted.resolve();
    }
    @swallowExceptions('Activating Unit Tests Manager for Language Server')
    protected async registerTestServices() {
        if (!this.languageClient) {
            throw new Error('languageClient not initialized');
        }
        await this.testManager.activate(new LanguageServerSymbolProvider(this.languageClient!));
    }
}
