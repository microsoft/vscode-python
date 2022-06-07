// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import '../../common/extensions';
import { Disposable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient/node';

import { ChildProcess } from 'child_process';
import { Resource } from '../../common/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { JediLanguageClientMiddleware } from './languageClientMiddleware';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerProxy } from '../types';
import { killPid } from '../../common/process/rawProcessApis';
import { traceDecoratorError, traceDecoratorVerbose, traceError } from '../../logging';

export class JediLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;

    private readonly disposables: Disposable[] = [];

    private lsVersion: string | undefined;

    constructor(private readonly factory: ILanguageClientFactory) {}

    private static versionTelemetryProps(instance: JediLanguageServerProxy) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    @traceDecoratorVerbose('Disposing language server')
    public dispose(): void {
        this.stop().ignoreErrors();
    }

    @traceDecoratorError('Failed to start language server')
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
        this.lsVersion =
            (options.middleware ? (<JediLanguageClientMiddleware>options.middleware).serverVersion : undefined) ??
            '0.19.3';

        const client = await this.factory.createLanguageClient(resource, interpreter, options);
        this.registerHandlers(client);

        await client.start();

        this.languageClient = client;
    }

    @traceDecoratorVerbose('Stopping language server')
    public async stop(): Promise<void> {
        while (this.disposables.length > 0) {
            const d = this.disposables.shift()!;
            d.dispose();
        }

        if (this.languageClient) {
            const client = this.languageClient;
            this.languageClient = undefined;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pid: number | undefined = ((client as any)._serverProcess as ChildProcess)?.pid;
            const killServer = () => {
                if (pid) {
                    killPid(pid);
                }
            };

            try {
                await client.stop();
                killServer();
            } catch (ex) {
                traceError('Stopping language client failed', ex);
                killServer();
            }
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
    private registerHandlers(client: LanguageClient) {
        const progressReporting = new ProgressReporting(client);
        this.disposables.push(progressReporting);
    }
}
