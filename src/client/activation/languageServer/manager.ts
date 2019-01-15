// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ICommandManager } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IDisposable, Resource } from '../../common/types';
import { debounce } from '../../common/utils/decorators';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { PYTHON_LANGUAGE_SERVER_STARTUP } from '../../telemetry/constants';
import { ILanaguageServer, ILanguageServerAnalysisOptions, ILanguageServerManager } from '../types';

const loadExtensionCommand = 'python._loadLanguageServerExtension';

@injectable()
export class LanguageServerManager implements ILanguageServerManager {
    protected static loadExtensionArgs?: {};
    private languageServer?: ILanaguageServer;
    private resource!: Resource;
    private disposables: IDisposable[] = [];
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(ILanguageServerAnalysisOptions) private readonly analysisOptions: ILanguageServerAnalysisOptions) { }
    public dispose() {
        if (this.languageServer) {
            this.languageServer.dispose();
        }
        this.disposables.forEach(d => d.dispose());
    }
    @traceDecorators.error('Failed to start Language Server')
    public async start(resource: Resource): Promise<void> {
        if (this.languageServer) {
            throw new Error('Language Server already started');
        }
        this.registerCommandHandler();
        this.resource = resource;
        this.analysisOptions.onDidChange(this.restartLanguageServer, this, this.disposables);

        await this.analysisOptions.initialize(resource);
        await this.startLanguageServer();
    }
    protected registerCommandHandler() {
        const disposable = this.commandManager.registerCommand(loadExtensionCommand, args => {
            LanguageServerManager.loadExtensionArgs = args;
            this.loadExtensionIfNecessary();
        });
        this.disposables.push(disposable);
    }
    protected loadExtensionIfNecessary() {
        if (this.languageServer && LanguageServerManager.loadExtensionArgs) {
            this.languageServer.loadExtension(LanguageServerManager.loadExtensionArgs);
        }
    }
    @traceDecorators.error('Failed to restart Language Server')
    @traceDecorators.verbose('Restarting Language Server')
    @debounce(1000)
    protected async restartLanguageServer(): Promise<void> {
        if (this.languageServer) {
            this.languageServer.dispose();
        }
        await this.startLanguageServer();
    }
    @captureTelemetry(PYTHON_LANGUAGE_SERVER_STARTUP, undefined, true)
    @traceDecorators.verbose('Starting Language Server')
    protected async startLanguageServer(): Promise<void> {
        this.languageServer = this.serviceContainer.get<ILanaguageServer>(ILanaguageServer);
        const options = await this.analysisOptions!.getAnalysisOptions();
        await this.languageServer.start(this.resource, options);
        this.loadExtensionIfNecessary();
    }
}
