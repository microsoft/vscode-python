// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Disposable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import { traceDecorators, traceError } from '../../common/logger';
import { Resource } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { PYTHON_LANGUAGE_SERVER_ENABLED, PYTHON_LANGUAGE_SERVER_READY, PYTHON_LANGUAGE_SERVER_TELEMETRY } from '../../telemetry/constants';
import { ProgressReporting } from '../progress';
import { ILanaguageServer as ILanguageServer, ILanguageClientFactory, LanguageClientFactory } from '../types';

@injectable()
export class LanguageServer implements ILanguageServer {
    private readonly startupCompleted: Deferred<void>;
    private readonly disposables: Disposable[] = [];

    private languageClient?: LanguageClient;

    constructor(@inject(ILanguageClientFactory) @named(LanguageClientFactory.base) private readonly factory: ILanguageClientFactory) {

        this.startupCompleted = createDeferred<void>();
    }
    @traceDecorators.verbose('Stopping Language Server')
    public dispose() {
        if (this.languageClient) {
            // Do not await on this.
            this.languageClient.stop()
                .then(noop, ex => traceError('Stopping language client failed', ex));
            this.languageClient = undefined;
        }
        while (this.disposables.length > 0) {
            const d = this.disposables.shift()!;
            d.dispose();
        }
    }

    @traceDecorators.error('Failed to start language server')
    @captureTelemetry(PYTHON_LANGUAGE_SERVER_ENABLED, undefined, true)
    public async start(resource: Resource, options: LanguageClientOptions): Promise<void> {
        this.languageClient = await this.factory.createLanguageClient(resource, options);
        this.disposables.push(this.languageClient!.start());
        await this.serverReady();
        const progressReporting = new ProgressReporting(this.languageClient!);
        this.disposables.push(progressReporting);
        this.languageClient.onTelemetry(telemetryEvent => {
            const eventName = telemetryEvent.EventName || PYTHON_LANGUAGE_SERVER_TELEMETRY;
            sendTelemetryEvent(eventName, telemetryEvent.Measurements, telemetryEvent.Properties);
        });
    }
    @traceDecorators.error('Failed to load Language Server extension')
    public loadExtension(args?: {}) {
        if (!this.languageClient) {
            throw new Error('Activation not completed or not invoked');
        }
        if (!this.startupCompleted.completed) {
            throw new Error('Activation not completed');
        }
        this.languageClient.sendRequest('python/loadExtension', args)
            .then(noop, ex => traceError('Request python/loadExtension failed', ex));
    }
    @captureTelemetry(PYTHON_LANGUAGE_SERVER_READY, undefined, true)
    private async serverReady(): Promise<void> {
        while (this.languageClient && !this.languageClient!.initializeResult) {
            await sleep(100);
        }
        this.startupCompleted.resolve();
    }
}
