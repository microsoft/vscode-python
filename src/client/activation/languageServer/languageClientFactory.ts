// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { IConfigurationService, Resource } from '../../common/types';
import { ILanguageClientFactory, ILanguageServerFolderService, IPlatformData, LanguageClientFactory } from '../types';

// tslint:disable:no-require-imports no-require-imports no-var-requires max-classes-per-file

const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';

@injectable()
export class BaseLanguageClientFactory implements ILanguageClientFactory {
    constructor(@inject(ILanguageClientFactory) @named(LanguageClientFactory.downloaded) private readonly downloadedFactory: ILanguageClientFactory,
        @inject(ILanguageClientFactory) @named(LanguageClientFactory.simple) private readonly simpleFactory: ILanguageClientFactory,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService) { }
    public async createLanguageClient(resource: Resource, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const settings = this.configurationService.getSettings(resource);
        const factory = settings.downloadLanguageServer ? this.downloadedFactory : this.simpleFactory;
        return factory.createLanguageClient(resource, clientOptions);
    }
}

/**
 * Creates a langauge client for use by users of the extension.
 *
 * @export
 * @class DownloadedLanguageClientFactory
 * @implements {ILanguageClientFactory}
 */
@injectable()
export class DownloadedLanguageClientFactory implements ILanguageClientFactory {
    constructor(@inject(IPlatformData) private readonly platformData: IPlatformData,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService) { }
    public async createLanguageClient(_resource: Resource, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName();
        const serverModule = path.join(EXTENSION_ROOT_DIR, languageServerFolder, this.platformData.engineExecutableName);

        const options = { stdio: 'pipe' };
        const serverOptions: ServerOptions = {
            run: { command: serverModule, rgs: [], options: options },
            debug: { command: serverModule, args: ['--debug'], options }
        };
        const vscodeLanguageClient = require('vscode-languageclient') as typeof import('vscode-languageclient');
        return new vscodeLanguageClient.LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}

/**
 * Creates a language client factory primarily used for LS development purposes.
 *
 * @export
 * @class SimpleLanguageClientFactory
 * @implements {ILanguageClientFactory}
 */
@injectable()
export class SimpleLanguageClientFactory implements ILanguageClientFactory {
    constructor(@inject(IPlatformData) private readonly platformData: IPlatformData,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService) { }
    public async createLanguageClient(_resource: Resource, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName();
        const commandOptions = { stdio: 'pipe' };
        const serverModule = path.join(EXTENSION_ROOT_DIR, languageServerFolder, this.platformData.engineDllName);
        const serverOptions: ServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: commandOptions },
            debug: { command: dotNetCommand, args: [serverModule, '--debug'], options: commandOptions }
        };
        const vscodeLanguageClient = require('vscode-languageclient') as typeof import('vscode-languageclient');
        return new vscodeLanguageClient.LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}
