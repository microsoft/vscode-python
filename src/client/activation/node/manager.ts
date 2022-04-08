// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { ICommandManager } from '../../common/application/types';
import { IDisposable, IExtensions, Resource } from '../../common/types';
import { debounceSync } from '../../common/utils/decorators';
import { IServiceContainer } from '../../ioc/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { Commands } from '../commands';
import { LanguageClientMiddleware } from '../languageClientMiddleware';
import {
    ILanguageServerAnalysisOptions,
    ILanguageServerManager,
    ILanguageServerProxy,
    LanguageServerType,
} from '../types';
import { traceDecoratorError, traceDecoratorVerbose } from '../../logging';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';

export class NodeLanguageServerManager implements ILanguageServerManager {
    private resource!: Resource;

    private interpreter: PythonEnvironment | undefined;

    private middleware: LanguageClientMiddleware | undefined;

    private disposables: IDisposable[] = [];

    private connected = false;

    private lsVersion: string | undefined;

    private started = false;

    constructor(
        private readonly serviceContainer: IServiceContainer,
        private readonly analysisOptions: ILanguageServerAnalysisOptions,
        private readonly languageServerProxy: ILanguageServerProxy,
        commandManager: ICommandManager,
        private readonly extensions: IExtensions,
    ) {
        this.disposables.push(
            commandManager.registerCommand(Commands.RestartLS, () => {
                this.restartLanguageServer().ignoreErrors();
            }),
        );
    }

    private static versionTelemetryProps(instance: NodeLanguageServerManager) {
        return {
            lsVersion: instance.lsVersion,
        };
    }

    public dispose(): void {
        if (this.languageProxy) {
            this.languageProxy.dispose();
        }
        this.disposables.forEach((d) => d.dispose());
    }

    public get languageProxy(): ILanguageServerProxy {
        return this.languageServerProxy;
    }

    @traceDecoratorError('Failed to start language server')
    public async start(resource: Resource, interpreter: PythonEnvironment | undefined): Promise<void> {
        if (this.started) {
            throw new Error('Language server already started');
        }
        this.resource = resource;
        this.interpreter = interpreter;
        this.analysisOptions.onDidChange(this.restartLanguageServerDebounced, this, this.disposables);

        const extension = this.extensions.getExtension(PYLANCE_EXTENSION_ID);
        this.lsVersion = extension?.packageJSON.version || '0';

        await this.analysisOptions.initialize(resource, interpreter);
        await this.startLanguageServer();

        this.started = true;
    }

    public connect(): void {
        if (!this.connected) {
            this.connected = true;
            this.middleware?.connect();
        }
    }

    public disconnect(): void {
        if (this.connected) {
            this.connected = false;
            this.middleware?.disconnect();
        }
    }

    @debounceSync(1000)
    protected restartLanguageServerDebounced(): void {
        this.restartLanguageServer().ignoreErrors();
    }

    @traceDecoratorError('Failed to restart language server')
    @traceDecoratorVerbose('Restarting language server')
    protected async restartLanguageServer(): Promise<void> {
        if (this.languageProxy) {
            this.languageProxy.dispose();
        }
        await this.startLanguageServer();
    }

    @captureTelemetry(
        EventName.LANGUAGE_SERVER_STARTUP,
        undefined,
        true,
        undefined,
        NodeLanguageServerManager.versionTelemetryProps,
    )
    @traceDecoratorVerbose('Starting language server')
    protected async startLanguageServer(): Promise<void> {
        const options = await this.analysisOptions.getAnalysisOptions();
        this.middleware = new LanguageClientMiddleware(this.serviceContainer, LanguageServerType.Node, this.lsVersion);
        options.middleware = this.middleware;

        // Make sure the middleware is connected if we restart and we we're already connected.
        if (this.connected) {
            this.middleware.connect();
        }

        // Then use this middleware to start a new language client.
        await this.languageServerProxy.start(this.resource, this.interpreter, options);
    }
}
