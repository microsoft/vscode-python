// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { CancellationToken, CompletionContext, ConfigurationChangeEvent, Disposable, Event, EventEmitter, OutputChannel, Position, TextDocument } from 'vscode';
import { LanguageClientOptions, ProvideCompletionItemsSignature } from 'vscode-languageclient';
import { IWorkspaceService } from '../../common/application/types';
import { isTestExecution, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import { traceDecorators, traceError } from '../../common/logger';
import { BANNER_NAME_PROPOSE_LS, IConfigurationService, IExtensionContext, IOutputChannel, IPathUtils, IPythonExtensionBanner, Resource } from '../../common/types';
import { debounce } from '../../common/utils/decorators';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { ILanguageServerAnalysisOptions, ILanguageServerFolderService } from '../types';

@injectable()
export class LanguageServerAnalysisOptions implements ILanguageServerAnalysisOptions {
    private envPythonPath: string = '';
    private excludedFiles: string[] = [];
    private typeshedPaths: string[] = [];
    private disposables: Disposable[] = [];
    private languageServerFolder: string = '';
    private resource: Resource;
    private readonly didChange = new EventEmitter<void>();
    constructor(@inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsProvider: IEnvironmentVariablesProvider,
        @inject(IConfigurationService) private readonly configuration: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IPythonExtensionBanner) @named(BANNER_NAME_PROPOSE_LS) private readonly surveyBanner: IPythonExtensionBanner,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: OutputChannel,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService) {

    }
    public async initialize(resource: Resource) {
        this.resource = resource;
        this.languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName();

        let disposable = this.workspace.onDidChangeConfiguration(this.onSettingsChangedHandler, this);
        this.disposables.push(disposable);

        disposable = this.interpreterService.onDidChangeInterpreter(() => this.didChange.fire(), this);
        this.disposables.push(disposable);

        disposable = this.envVarsProvider.onDidEnvironmentVariablesChange(this.onEnvVarChange, this);
        this.disposables.push(disposable);
    }
    public get onDidChange(): Event<void> {
        return this.didChange.event;
    }
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.didChange.dispose();
    }
    @traceDecorators.error('Failed to get analysis options')
    public async getAnalysisOptions(): Promise<LanguageClientOptions> {
        const properties: Record<string, {}> = {};

        const interpreterInfo = await this.interpreterService.getActiveInterpreter(this.resource);
        if (!interpreterInfo) {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: How do we handle this?  It is pretty unlikely...
            throw Error('did not find an active interpreter');
        }

        // tslint:disable-next-line:no-string-literal
        properties['InterpreterPath'] = interpreterInfo.path;

        const version = interpreterInfo.version;
        if (version) {
            // tslint:disable-next-line:no-string-literal
            properties['Version'] = `${version.major}.${version.minor}.${version.patch}`;
        } else {
            traceError('Unable to determine Python version. Analysis may be limited.');
        }

        let searchPaths = [];

        const settings = this.configuration.getSettings(this.resource);
        if (settings.autoComplete) {
            const extraPaths = settings.autoComplete.extraPaths;
            if (extraPaths && extraPaths.length > 0) {
                searchPaths.push(...extraPaths);
            }
        }

        // tslint:disable-next-line:no-string-literal
        properties['DatabasePath'] = path.join(this.context.extensionPath, this.languageServerFolder);

        const vars = await this.envVarsProvider.getEnvironmentVariables();
        this.envPythonPath = vars.PYTHONPATH || '';
        if (this.envPythonPath !== '') {
            const paths = this.envPythonPath.split(this.pathUtils.delimiter).filter(item => item.trim().length > 0);
            searchPaths.push(...paths);
        }

        searchPaths = searchPaths.map(p => path.normalize(p));

        this.excludedFiles = this.getExcludedFiles();
        this.typeshedPaths = this.getTypeshedPaths();
        const workspaceFolder = this.workspace.getWorkspaceFolder(this.resource);
        const documentSelector = [
            { scheme: 'file', language: PYTHON_LANGUAGE },
            { scheme: 'untitled', language: PYTHON_LANGUAGE }
        ];
        if (workspaceFolder) {
            // tslint:disable-next-line:no-any
            (documentSelector[0] as any).pattern = `${workspaceFolder.uri.fsPath}/**/*`;
        }
        // Options to control the language client
        return {
            // Register the server for Python documents
            documentSelector,
            workspaceFolder,
            synchronize: {
                configurationSection: PYTHON_LANGUAGE
            },
            outputChannel: this.output,
            initializationOptions: {
                interpreter: {
                    properties
                },
                displayOptions: {
                    preferredFormat: 'markdown',
                    trimDocumentationLines: false,
                    maxDocumentationLineLength: 0,
                    trimDocumentationText: false,
                    maxDocumentationTextLength: 0
                },
                searchPaths,
                typeStubSearchPaths: this.typeshedPaths,
                excludeFiles: this.excludedFiles,
                testEnvironment: isTestExecution(),
                analysisUpdates: true,
                traceLogging: true, // Max level, let LS decide through settings actual level of logging.
                asyncStartup: true
            },
            middleware: {
                provideCompletionItem: (document: TextDocument, position: Position, context: CompletionContext, token: CancellationToken, next: ProvideCompletionItemsSignature) => {
                    this.surveyBanner.showBanner().ignoreErrors();
                    return next(document, position, context, token);
                }
            }
        };
    }
    protected getExcludedFiles(): string[] {
        const list: string[] = ['**/Lib/**', '**/site-packages/**'];
        this.getVsCodeExcludeSection('search.exclude', list);
        this.getVsCodeExcludeSection('files.exclude', list);
        this.getVsCodeExcludeSection('files.watcherExclude', list);
        this.getPythonExcludeSection(list);
        return list;
    }

    protected getVsCodeExcludeSection(setting: string, list: string[]): void {
        const states = this.workspace.getConfiguration(setting);
        if (states) {
            Object.keys(states)
                .filter(k => (k.indexOf('*') >= 0 || k.indexOf('/') >= 0) && states[k])
                .forEach(p => list.push(p));
        }
    }
    protected getPythonExcludeSection(list: string[]): void {
        const pythonSettings = this.configuration.getSettings(this.resource);
        const paths = pythonSettings && pythonSettings.linting ? pythonSettings.linting.ignorePatterns : undefined;
        if (paths && Array.isArray(paths)) {
            paths
                .filter(p => p && p.length > 0)
                .forEach(p => list.push(p));
        }
    }
    protected getTypeshedPaths(): string[] {
        const settings = this.configuration.getSettings(this.resource);
        return settings.analysis.typeshedPaths && settings.analysis.typeshedPaths.length > 0
            ? settings.analysis.typeshedPaths
            : [path.join(this.context.extensionPath, this.languageServerFolder, 'Typeshed')];
    }
    protected async onSettingsChangedHandler(e?: ConfigurationChangeEvent): Promise<void> {
        if (e && !e.affectsConfiguration('python', this.resource)) {
            return;
        }
        this.onSettingsChanged();
    }
    @debounce(1000)
    protected onSettingsChanged(): void {
        this.notifyIfSettingsChanged().ignoreErrors();
    }
    @traceDecorators.verbose('Changes in python settings detected in analysis options')
    protected async notifyIfSettingsChanged(): Promise<void> {
        const excludedFiles = this.getExcludedFiles();
        await this.notifyIfValuesHaveChanged(this.excludedFiles, excludedFiles);

        const typeshedPaths = this.getTypeshedPaths();
        await this.notifyIfValuesHaveChanged(this.typeshedPaths, typeshedPaths);
    }

    protected async notifyIfValuesHaveChanged(oldArray: string[], newArray: string[]): Promise<void> {
        if (newArray.length !== oldArray.length) {
            this.didChange.fire();
            return;
        }

        for (let i = 0; i < oldArray.length; i += 1) {
            if (oldArray[i] !== newArray[i]) {
                this.didChange.fire();
                return;
            }
        }
    }

    @debounce(1000)
    protected onEnvVarChange(): void {
        this.notifyifEnvPythonPathChanged().ignoreErrors();
    }

    protected async notifyifEnvPythonPathChanged(): Promise<void> {
        const vars = await this.envVarsProvider.getEnvironmentVariables();
        const envPythonPath = vars.PYTHONPATH;

        if (this.envPythonPath !== envPythonPath) {
            this.didChange.fire();
        }
    }
}
