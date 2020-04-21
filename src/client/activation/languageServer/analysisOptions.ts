// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationChangeEvent, WorkspaceFolder } from 'vscode';
import { DocumentFilter } from 'vscode-languageclient';

import { IWorkspaceService } from '../../common/application/types';
import { traceDecorators, traceError } from '../../common/logger';
import { IConfigurationService, IExtensionContext, IPathUtils, Resource } from '../../common/types';
import { debounceSync } from '../../common/utils/decorators';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerFolderService, ILanguageServerOutputChannel } from '../types';

@injectable()
export class DotNetLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    private resource: Resource;
    private interpreter: PythonInterpreter | undefined;
    private languageServerFolder: string = '';
    private excludedFiles: string[] = [];
    private typeshedPaths: string[] = [];

    constructor(
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IEnvironmentVariablesProvider) envVarsProvider: IEnvironmentVariablesProvider,
        @inject(IConfigurationService) private readonly configuration: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(ILanguageServerOutputChannel) lsOutputChannel: ILanguageServerOutputChannel,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService
    ) {
        super(envVarsProvider, lsOutputChannel);
    }

    public async initialize(resource: Resource, interpreter: PythonInterpreter | undefined) {
        await super.initialize(resource, interpreter);

        this.resource = resource;
        this.interpreter = interpreter;
        this.languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName(resource);

        const disposable = this.workspace.onDidChangeConfiguration(this.onSettingsChangedHandler, this);
        this.disposables.push(disposable);
    }

    protected getWorkspaceFolder(): WorkspaceFolder | undefined {
        return this.workspace.getWorkspaceFolder(this.resource);
    }

    protected getDocumentFilters(workspaceFolder?: WorkspaceFolder): DocumentFilter[] {
        const filters = super.getDocumentFilters(workspaceFolder);

        // Set the document selector only when in a multi-root workspace scenario.
        if (
            workspaceFolder &&
            Array.isArray(this.workspace.workspaceFolders) &&
            this.workspace.workspaceFolders!.length > 1
        ) {
            filters[0].pattern = `${workspaceFolder.uri.fsPath}/**/*`;
        }

        return filters;
    }

    protected async getInitializationOptions() {
        const properties: Record<string, {}> = {};

        const interpreterInfo = this.interpreter;
        if (!interpreterInfo) {
            throw Error('did not find an active interpreter');
        }

        properties.InterpreterPath = interpreterInfo.path;

        const version = interpreterInfo.version;
        if (version) {
            properties.Version = `${version.major}.${version.minor}.${version.patch}`;
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

        const envPythonPath = await this.getEnvPythonPath();
        if (envPythonPath !== '') {
            const paths = envPythonPath.split(this.pathUtils.delimiter).filter((item) => item.trim().length > 0);
            searchPaths.push(...paths);
        }

        searchPaths = searchPaths.map((p) => path.normalize(p));

        return {
            interpreter: {
                properties
            },
            searchPaths,
            typeStubSearchPaths: this.typeshedPaths,
            cacheFolderPath: this.getCacheFolderPath(),
            excludeFiles: this.excludedFiles
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
                .filter((k) => (k.indexOf('*') >= 0 || k.indexOf('/') >= 0) && states[k])
                .forEach((p) => list.push(p));
        }
    }

    protected getPythonExcludeSection(list: string[]): void {
        const pythonSettings = this.configuration.getSettings(this.resource);
        const paths = pythonSettings && pythonSettings.linting ? pythonSettings.linting.ignorePatterns : undefined;
        if (paths && Array.isArray(paths)) {
            paths.filter((p) => p && p.length > 0).forEach((p) => list.push(p));
        }
    }

    protected getTypeshedPaths(): string[] {
        const settings = this.configuration.getSettings(this.resource);
        return settings.analysis.typeshedPaths && settings.analysis.typeshedPaths.length > 0
            ? settings.analysis.typeshedPaths
            : [path.join(this.context.extensionPath, this.languageServerFolder, 'Typeshed')];
    }

    protected getCacheFolderPath(): string | null {
        const settings = this.configuration.getSettings(this.resource);
        return settings.analysis.cacheFolderPath && settings.analysis.cacheFolderPath.length > 0
            ? settings.analysis.cacheFolderPath
            : null;
    }

    protected async onSettingsChangedHandler(e?: ConfigurationChangeEvent): Promise<void> {
        if (e && !e.affectsConfiguration('python', this.resource)) {
            return;
        }
        this.onSettingsChanged();
    }

    @debounceSync(1000)
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
}
