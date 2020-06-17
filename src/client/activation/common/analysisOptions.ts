// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import { Disposable, Event, EventEmitter, WorkspaceFolder } from 'vscode';
import { DocumentFilter, LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient';

import { PYTHON, PYTHON_LANGUAGE } from '../../common/constants';
import { traceDecorators } from '../../common/logger';
import { IOutputChannel, Resource } from '../../common/types';
import { debounceSync } from '../../common/utils/decorators';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { ILanguageServerAnalysisOptions, ILanguageServerOutputChannel } from '../types';

@injectable()
export abstract class LanguageServerAnalysisOptionsBase implements ILanguageServerAnalysisOptions {
    protected disposables: Disposable[] = [];
    protected readonly didChange = new EventEmitter<void>();
    private envPythonPath: string = '';
    private readonly output: IOutputChannel;

    protected constructor(
        private readonly envVarsProvider: IEnvironmentVariablesProvider,
        lsOutputChannel: ILanguageServerOutputChannel
    ) {
        this.output = lsOutputChannel.channel;
    }

    public async initialize(_resource: Resource, _interpreter: PythonInterpreter | undefined) {
        const disposable = this.envVarsProvider.onDidEnvironmentVariablesChange(this.onEnvVarChange, this);
        this.disposables.push(disposable);
    }

    public get onDidChange(): Event<void> {
        return this.didChange.event;
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        this.didChange.dispose();
    }

    @traceDecorators.error('Failed to get analysis options')
    public async getAnalysisOptions(): Promise<LanguageClientOptions> {
        const workspaceFolder = this.getWorkspaceFolder();
        const documentSelector = this.getDocumentFilters(workspaceFolder);

        return {
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

    protected getWorkspaceFolder(): WorkspaceFolder | undefined {
        return undefined;
    }

    protected getDocumentFilters(_workspaceFolder?: WorkspaceFolder): DocumentFilter[] {
        return PYTHON;
    }

    // tslint:disable-next-line: no-any
    protected async getInitializationOptions(): Promise<any> {
        return undefined;
    }

    protected async getEnvPythonPath(): Promise<string> {
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
