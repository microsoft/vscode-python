// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import '../../common/extensions';
import { traceDecorators } from '../../common/logger';
import { IDisposable, Resource } from '../../common/types';
import { debounce } from '../../common/utils/decorators';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ILanguageServer, ILanguageServerAnalysisOptions, ILanguageServerExtension, ILanguageServerManager } from '../types';

@injectable()
export class LanguageServerManager implements ILanguageServerManager {
    private languageServer?: ILanguageServer;
    private resource!: Resource;
    private disposables: IDisposable[] = [];
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(ILanguageServerAnalysisOptions) private readonly analysisOptions: ILanguageServerAnalysisOptions,
        @inject(ILanguageServerExtension) private readonly lsExtension: ILanguageServerExtension
    ) { }
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
        this.analysisOptions.onDidChange(this.restartLanguageServerDebounced, this, this.disposables);

        await this.analysisOptions.initialize(resource);
        await this.startLanguageServer();
    }
    protected registerCommandHandler() {
        this.lsExtension.invoked(this.loadExtensionIfNecessary, this, this.disposables);
    }
    protected loadExtensionIfNecessary() {
        if (this.languageServer && this.lsExtension.loadExtensionArgs) {
            this.languageServer.loadExtension(this.lsExtension.loadExtensionArgs);
        }
    }
    @debounce(1000)
    protected restartLanguageServerDebounced(): void {
        this.restartLanguageServer().ignoreErrors();
    }
    @traceDecorators.error('Failed to restart Language Server')
    @traceDecorators.verbose('Restarting Language Server')
    protected async restartLanguageServer(): Promise<void> {
        if (this.languageServer) {
            this.languageServer.dispose();
        }
        await this.startLanguageServer();
    }
    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_STARTUP, undefined, true)
    @traceDecorators.verbose('Starting Language Server')
    protected async startLanguageServer(): Promise<void> {
        this.languageServer = this.serviceContainer.get<ILanguageServer>(ILanguageServer);
        const options = await this.analysisOptions!.getAnalysisOptions();
        await this.languageServer.start(this.resource, options);
        this.loadExtensionIfNecessary();
    }
}
