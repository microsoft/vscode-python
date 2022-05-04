// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import '../../common/extensions';
import {
    DidChangeConfigurationNotification,
    Disposable,
    LanguageClient,
    LanguageClientOptions,
} from 'vscode-languageclient/node';

import { ChildProcess } from 'child_process';
import { IInterpreterPathService, Resource } from '../../common/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { LanguageClientMiddleware } from '../languageClientMiddleware';
import { ProgressReporting } from '../progress';
import { ILanguageClientFactory, ILanguageServerProxy } from '../types';
import { killPid } from '../../common/process/rawProcessApis';
import { traceDecoratorError, traceDecoratorVerbose, traceError } from '../../logging';

export class JediLanguageServerProxy implements ILanguageServerProxy {
    public languageClient: LanguageClient | undefined;

    private languageServerTask: Promise<void> | undefined;

    private readonly disposables: Disposable[] = [];

    private disposed = false;

    private lsVersion: string | undefined;

    constructor(
        private readonly factory: ILanguageClientFactory,
        private readonly interpreterPathService: IInterpreterPathService,
    ) {}

    private static versionTelemetryProps(instance: JediLanguageServerProxy) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    @traceDecoratorVerbose('Stopping language server')
    public dispose(): void {
        if (this.languageClient) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pid: number | undefined = ((this.languageClient as any)._serverProcess as ChildProcess)?.pid;
            const killServer = () => {
                if (pid) {
                    killPid(pid);
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
            this.languageServerTask = undefined;
        }

        while (this.disposables.length > 0) {
            const d = this.disposables.shift()!;
            d.dispose();
        }

        this.disposed = true;
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
        if (this.languageServerTask) {
            await this.languageServerTask;
            return;
        }

        this.lsVersion =
            (options.middleware ? (<LanguageClientMiddleware>options.middleware).serverVersion : undefined) ?? '0.19.3';

        this.languageClient = await this.factory.createLanguageClient(resource, interpreter, options);
        this.registerHandlers();

        this.languageServerTask = this.languageClient.start();
        await this.languageServerTask;
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
    private registerHandlers() {
        if (this.disposed) {
            // Check if it got disposed in the interim.
            return;
        }

        const progressReporting = new ProgressReporting(this.languageClient!);
        this.disposables.push(progressReporting);

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
