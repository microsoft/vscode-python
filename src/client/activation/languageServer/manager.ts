// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable, named } from 'inversify';

import { ICommandManager } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IConfigurationService, IDisposable, IExperimentsManager, Resource } from '../../common/types';
import { debounceSync } from '../../common/utils/decorators';
import { IServiceContainer } from '../../ioc/types';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { Commands } from '../commands';
import { LanguageClientMiddleware } from '../languageClientMiddleware';
import {
    ILanguageServerAnalysisOptions,
    ILanguageServerExtension,
    ILanguageServerFolderService,
    ILanguageServerManager,
    ILanguageServerProxy,
    LanguageServerType
} from '../types';

@injectable()
export class DotNetLanguageServerManager implements ILanguageServerManager {
    private languageServerProxy?: ILanguageServerProxy;
    private resource!: Resource;
    private interpreter: PythonInterpreter | undefined;
    private middleware: LanguageClientMiddleware | undefined;
    private disposables: IDisposable[] = [];
    private connected: boolean = false;
    private lsVersion: string | undefined;

    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(ILanguageServerAnalysisOptions)
        @named(LanguageServerType.Microsoft)
        private readonly analysisOptions: ILanguageServerAnalysisOptions,
        @inject(ILanguageServerExtension) private readonly lsExtension: ILanguageServerExtension,
        @inject(ILanguageServerFolderService) private readonly folderService: ILanguageServerFolderService,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager
    ) {
        this.disposables.push(
            commandManager.registerCommand(Commands.RestartLS, () => {
                this.restartLanguageServer().ignoreErrors();
            })
        );
    }

    private static versionTelemetryProps(instance: DotNetLanguageServerManager) {
        return {
            lsVersion: instance.lsVersion
        };
    }

    public dispose() {
        if (this.languageProxy) {
            this.languageProxy.dispose();
        }
        this.disposables.forEach((d) => d.dispose());
    }

    public get languageProxy() {
        return this.languageServerProxy;
    }
    @traceDecorators.error('Failed to start language server')
    public async start(resource: Resource, interpreter: PythonInterpreter | undefined): Promise<void> {
        if (this.languageProxy) {
            throw new Error('Language server already started');
        }
        this.registerCommandHandler();
        this.resource = resource;
        this.interpreter = interpreter;
        this.analysisOptions.onDidChange(this.restartLanguageServerDebounced, this, this.disposables);

        const versionPair = await this.folderService.getCurrentLanguageServerDirectory();
        this.lsVersion = versionPair?.version.format();

        await this.analysisOptions.initialize(resource, interpreter);
        await this.startLanguageServer();
    }
    public connect() {
        this.connected = true;
        this.middleware?.connect();
    }
    public disconnect() {
        this.connected = false;
        this.middleware?.disconnect();
    }
    protected registerCommandHandler() {
        this.lsExtension.invoked(this.loadExtensionIfNecessary, this, this.disposables);
    }
    protected loadExtensionIfNecessary() {
        if (this.languageProxy && this.lsExtension.loadExtensionArgs) {
            this.languageProxy.loadExtension(this.lsExtension.loadExtensionArgs);
        }
    }
    @debounceSync(1000)
    protected restartLanguageServerDebounced(): void {
        this.restartLanguageServer().ignoreErrors();
    }
    @traceDecorators.error('Failed to restart language server')
    @traceDecorators.verbose('Restarting language server')
    protected async restartLanguageServer(): Promise<void> {
        if (this.languageProxy) {
            this.languageProxy.dispose();
        }
        await this.startLanguageServer();
    }
    @captureTelemetry(
        EventName.PYTHON_LANGUAGE_SERVER_STARTUP,
        undefined,
        true,
        undefined,
        DotNetLanguageServerManager.versionTelemetryProps
    )
    @traceDecorators.verbose('Starting language server')
    protected async startLanguageServer(): Promise<void> {
        this.languageServerProxy = this.serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy);

        const options = await this.analysisOptions!.getAnalysisOptions();
        options.middleware = this.middleware = new LanguageClientMiddleware(
            this.experimentsManager,
            this.configService,
            LanguageServerType.Microsoft,
            this.lsVersion
        );

        // Make sure the middleware is connected if we restart and we we're already connected.
        if (this.connected) {
            this.middleware.connect();
        }

        // Then use this middleware to start a new language client.
        await this.languageServerProxy.start(this.resource, this.interpreter, options);
        this.loadExtensionIfNecessary();
    }
}
