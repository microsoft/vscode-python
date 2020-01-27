// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, unmanaged } from 'inversify';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';

import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { IConfigurationService, Resource } from '../../common/types';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { ILanguageClientFactory, ILanguageServerFolderService, IPlatformData } from '../types';

// tslint:disable:no-require-imports no-require-imports no-var-requires max-classes-per-file

const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';

export class DotNetDownloadedLanguageClientFactory implements ILanguageClientFactory {
    constructor(private readonly platformData: IPlatformData, private readonly languageServerFolderService: ILanguageServerFolderService) {}

    public async createLanguageClient(
        resource: Resource,
        _interpreter: PythonInterpreter | undefined,
        clientOptions: LanguageClientOptions,
        env?: NodeJS.ProcessEnv
    ): Promise<LanguageClient> {
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName(resource);
        const serverModule = path.join(EXTENSION_ROOT_DIR, languageServerFolder, this.platformData.engineExecutableName);
        const options = { stdio: 'pipe', env };
        const serverOptions: ServerOptions = {
            run: { command: serverModule, args: [], options },
            debug: { command: serverModule, args: ['--debug'], options }
        };
        const vscodeLanguageClient = require('vscode-languageclient') as typeof import('vscode-languageclient');
        return new vscodeLanguageClient.LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}

export class DotNetSimpleLanguageClientFactory implements ILanguageClientFactory {
    constructor(private readonly platformData: IPlatformData, private readonly languageServerFolderService: ILanguageServerFolderService) {}

    public async createLanguageClient(
        resource: Resource,
        _interpreter: PythonInterpreter | undefined,
        clientOptions: LanguageClientOptions,
        env?: NodeJS.ProcessEnv
    ): Promise<LanguageClient> {
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName(resource);
        const options = { stdio: 'pipe', env };
        const serverModule = path.join(EXTENSION_ROOT_DIR, languageServerFolder, this.platformData.engineDllName);
        const serverOptions: ServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options }
        };
        const vscodeLanguageClient = require('vscode-languageclient') as typeof import('vscode-languageclient');
        return new vscodeLanguageClient.LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}

@injectable()
export class DotNetLanguageClientFactory implements ILanguageClientFactory {
    constructor(
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsProvider: IEnvironmentVariablesProvider,
        @inject(IEnvironmentActivationService) private readonly environmentActivationService: IEnvironmentActivationService,
        @inject(IPlatformData) private readonly platformData: IPlatformData,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService,
        @unmanaged() private readonly downloadedFactory: ILanguageClientFactory,
        @unmanaged() private readonly simpleFactory: ILanguageClientFactory
    ) {}

    public async createLanguageClient(resource: Resource, interpreter: PythonInterpreter | undefined, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const settings = this.configurationService.getSettings(resource);
        let factory: ILanguageClientFactory;
        if (this.platformData && this.languageServerFolderService) {
            factory = settings.downloadLanguageServer
                ? new DotNetDownloadedLanguageClientFactory(this.platformData, this.languageServerFolderService)
                : new DotNetSimpleLanguageClientFactory(this.platformData, this.languageServerFolderService);
        } else {
            factory = settings.downloadLanguageServer ? this.downloadedFactory : this.simpleFactory;
        }
        const env = await this.getEnvVars(resource, interpreter);
        return factory.createLanguageClient(resource, interpreter, clientOptions, env);
    }

    private async getEnvVars(resource: Resource, interpreter: PythonInterpreter | undefined): Promise<NodeJS.ProcessEnv> {
        const envVars = await this.environmentActivationService.getActivatedEnvironmentVariables(resource, interpreter);
        if (envVars && Object.keys(envVars).length > 0) {
            return envVars;
        }
        return this.envVarsProvider.getEnvironmentVariables(resource);
    }
}
