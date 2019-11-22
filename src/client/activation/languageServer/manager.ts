// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { traceDecorators } from '../../common/logger';
import { IDisposable, Resource } from '../../common/types';
import { debounceSync } from '../../common/utils/decorators';
import { PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import {
    ILanguageServerAnalysisOptions,
    ILanguageServerExtension,
    ILanguageServerManager,
    ILanguageServerProxy
} from '../types';

@injectable()
export class LanguageServerManager implements ILanguageServerManager {
    private languageServerProxy?: ILanguageServerProxy;
    private resource!: Resource;
    private interpreter: PythonInterpreter | undefined;
    private disposables: IDisposable[] = [];
    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(ILanguageServerAnalysisOptions) private readonly analysisOptions: ILanguageServerAnalysisOptions,
        @inject(ILanguageServerExtension) private readonly lsExtension: ILanguageServerExtension
    ) { }
    public dispose() {
        if (this.languageProxy) {
            this.languageProxy.dispose();
        }
        this.disposables.forEach(d => d.dispose());
    }

    public get languageProxy() {
        return this.languageServerProxy;
    }
    @traceDecorators.error('Failed to start Language Server')
    public async start(resource: Resource, interpreter: PythonInterpreter | undefined): Promise<void> {
        if (this.languageProxy) {
            throw new Error('Language Server already started');
        }
        this.registerCommandHandler();
        this.resource = resource;
        this.interpreter = interpreter;
        this.analysisOptions.onDidChange(this.restartLanguageServerDebounced, this, this.disposables);

        await this.analysisOptions.initialize(resource);
        await this.startLanguageServer();
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
    @traceDecorators.error('Failed to restart Language Server')
    @traceDecorators.verbose('Restarting Language Server')
    protected async restartLanguageServer(): Promise<void> {
        if (this.languageProxy) {
            this.languageProxy.dispose();
        }
        await this.startLanguageServer();
    }
    @captureTelemetry(EventName.PYTHON_LANGUAGE_SERVER_STARTUP, undefined, true)
    @traceDecorators.verbose('Starting Language Server')
    protected async startLanguageServer(): Promise<void> {
        this.languageServerProxy = this.serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy);
        const options = await this.analysisOptions!.getAnalysisOptions();
        await this.languageServerProxy.start(this.resource, this.interpreter, options);
        this.loadExtensionIfNecessary();
    }
}
