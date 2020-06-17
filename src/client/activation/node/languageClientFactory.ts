// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { ILanguageClientFactory, ILanguageServerFolderService } from '../types';
import { FileBasedCancellationStrategy } from './cancellationUtils';

// tslint:disable:no-require-imports no-require-imports no-var-requires max-classes-per-file
const languageClientName = 'Python Tools';

@injectable()
export class NodeLanguageClientFactory implements ILanguageClientFactory {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService
    ) {}

    public async createLanguageClient(
        resource: Resource,
        _interpreter: PythonInterpreter | undefined,
        clientOptions: LanguageClientOptions
    ): Promise<LanguageClient> {
        // this must exist for node language client
        const commandArgs = (clientOptions.connectionOptions
            ?.cancellationStrategy as FileBasedCancellationStrategy).getCommandLineArguments();

        const folderName = await this.languageServerFolderService.getLanguageServerFolderName(resource);
        const languageServerFolder = path.isAbsolute(folderName)
            ? folderName
            : path.join(EXTENSION_ROOT_DIR, folderName);

        const bundlePath = path.join(languageServerFolder, 'server.bundle.js');
        const nonBundlePath = path.join(languageServerFolder, 'server.js');
        const modulePath = (await this.fs.fileExists(nonBundlePath)) ? nonBundlePath : bundlePath;
        const debugOptions = { execArgv: ['--nolazy', '--inspect=6600'] };

        // If the extension is launched in debug mode, then the debug server options are used.
        const serverOptions: ServerOptions = {
            run: {
                module: bundlePath,
                transport: TransportKind.ipc,
                args: commandArgs
            },
            // In debug mode, use the non-bundled code if it's present. The production
            // build includes only the bundled package, so we don't want to crash if
            // someone starts the production extension in debug mode.
            debug: {
                module: modulePath,
                transport: TransportKind.ipc,
                options: debugOptions,
                args: commandArgs
            }
        };

        const vscodeLanguageClient = require('vscode-languageclient/node') as typeof import('vscode-languageclient/node');
        return new vscodeLanguageClient.LanguageClient(
            PYTHON_LANGUAGE,
            languageClientName,
            serverOptions,
            clientOptions
        );
    }
}
