// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { IConfigurationService, Resource } from '../../common/types';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { ILanguageClientFactory, LanguageClientFactory } from '../types';
import { IFileSystem } from '../../common/platform/types';

// tslint:disable:no-require-imports no-require-imports no-var-requires max-classes-per-file
const languageClientName = 'Python Tools';

@injectable()
export class PyRxLanguageClientFactory implements ILanguageClientFactory {
    constructor(
        @inject(ILanguageClientFactory) @named(LanguageClientFactory.downloaded) private readonly downloadedFactory: ILanguageClientFactory,
        @inject(ILanguageClientFactory) @named(LanguageClientFactory.simple) private readonly simpleFactory: ILanguageClientFactory,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsProvider: IEnvironmentVariablesProvider,
        @inject(IEnvironmentActivationService) private readonly environmentActivationService: IEnvironmentActivationService
    ) { }
    public async createLanguageClient(resource: Resource, interpreter: PythonInterpreter | undefined, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const settings = this.configurationService.getSettings(resource);
        const factory = settings.downloadLanguageServer ? this.downloadedFactory : this.simpleFactory;
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

/**
 * Creates a language client for use by users of the extension.
 *
 * @export
 * @class DownloadedLanguageClientFactory
 * @implements {ILanguageClientFactory}
 */
@injectable()
export class DownloadedLanguageClientFactory implements ILanguageClientFactory {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem
    ) { }
    public async createLanguageClient(
        _resource: Resource,
        _interpreter: PythonInterpreter | undefined,
        clientOptions: LanguageClientOptions,
        _env?: NodeJS.ProcessEnv
    ): Promise<LanguageClient> {
        const bundlePath = path.join(EXTENSION_ROOT_DIR, 'pyrx', 'server', 'server.bundle.js');
        const nonBundlePath = path.join(EXTENSION_ROOT_DIR, 'pyrx', 'server', 'server.js');
        const debugOptions = { execArgv: ["--nolazy", "--inspect=6600"] };
        // If the extension is launched in debug mode, then the debug server options are used.
        const serverOptions: ServerOptions = {
            run: { module: bundlePath, transport: TransportKind.ipc },
            // In debug mode, use the non-bundled code if it's present. The production
            // build includes only the bundled package, so we don't want to crash if
            // someone starts the production extension in debug mode.
            debug: {
                module: this.fs.fileExists(nonBundlePath) ? nonBundlePath : bundlePath,
                transport: TransportKind.ipc, options: debugOptions
            }
        }
        const vscodeLanguageClient = require('vscode-languageclient') as typeof import('vscode-languageclient');
        return new vscodeLanguageClient.LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}
