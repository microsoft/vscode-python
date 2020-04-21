// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import { Disposable, Event, EventEmitter, WorkspaceFolder } from 'vscode';
import { DocumentFilter, LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient';

import { IWorkspaceService } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceDecorators } from '../../common/logger';
import { IOutputChannel, Resource } from '../../common/types';
import { debounceSync } from '../../common/utils/decorators';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { ILanguageServerAnalysisOptions, ILanguageServerOutputChannel } from '../types';

@injectable()
export abstract class LanguageServerAnalysisOptionsBase implements ILanguageServerAnalysisOptions {
    public get onDidChange(): Event<void> {
        return this.didChange.event;
    }

    protected disposables: Disposable[] = [];
    protected resource: Resource;
    protected readonly didChange = new EventEmitter<void>();
    private envPythonPath: string = '';
    private output: IOutputChannel;

    protected constructor(
        private readonly envVarsProvider: IEnvironmentVariablesProvider,
        protected readonly workspace: IWorkspaceService,
        protected readonly lsOutputChannel: ILanguageServerOutputChannel
    ) {
        this.output = this.lsOutputChannel.channel;
    }

    public async initialize(resource: Resource, _interpreter: PythonInterpreter | undefined) {
        this.resource = resource;

        const disposable = this.envVarsProvider.onDidEnvironmentVariablesChange(this.onEnvVarChange, this);
        this.disposables.push(disposable);
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        this.didChange.dispose();
    }

    @traceDecorators.error('Failed to get analysis options')
    public async getAnalysisOptions(): Promise<LanguageClientOptions> {
        const workspaceFolder = this.workspace.getWorkspaceFolder(this.resource);
        const documentSelector = this.getDocumentFilters(workspaceFolder);
        // Options to control the language client.
        return {
            // Register the server for Python documents.
            documentSelector,
            workspaceFolder,
            synchronize: {
                configurationSection: PYTHON_LANGUAGE
            },
            outputChannel: this.output,
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            initializationOptions: await this.getInitializationOptions()
        };
    }

    // tslint:disable-next-line: no-any
    protected abstract async getInitializationOptions(): Promise<any>;

    protected getDocumentFilters(_workspaceFolder?: WorkspaceFolder): DocumentFilter[] {
        return [
            { scheme: 'file', language: PYTHON_LANGUAGE },
            { scheme: 'untitled', language: PYTHON_LANGUAGE }
        ];
    }

    protected async getEnvPythonPath() {
        const vars = await this.envVarsProvider.getEnvironmentVariables();
        this.envPythonPath = vars.PYTHONPATH || '';
        return this.envPythonPath;
    }

    @debounceSync(1000)
    protected onEnvVarChange(): void {
        this.notifyifEnvPythonPathChanged().ignoreErrors();
    }

    protected async notifyifEnvPythonPathChanged(): Promise<void> {
        const vars = await this.envVarsProvider.getEnvironmentVariables();
        const envPythonPath = vars.PYTHONPATH || '';

        if (this.envPythonPath !== envPythonPath) {
            this.didChange.fire();
        }
    }
}
