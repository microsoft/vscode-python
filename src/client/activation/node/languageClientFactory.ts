// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { ILanguageClientFactory } from '../types';

// tslint:disable:no-require-imports no-require-imports no-var-requires max-classes-per-file
const languageClientName = 'Python Tools';

@injectable()
export class NodeLanguageClientFactory implements ILanguageClientFactory {
    constructor(@inject(IFileSystem) private readonly fs: IFileSystem) {}
    public async createLanguageClient(_resource: Resource, _interpreter: PythonInterpreter | undefined, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
        const bundlePath = path.join(EXTENSION_ROOT_DIR, 'nodeLanguageServer', 'server.bundle.js');
        const nonBundlePath = path.join(EXTENSION_ROOT_DIR, 'nodeLanguageServer', 'server.js');
        const modulePath = (await this.fs.fileExists(nonBundlePath)) ? nonBundlePath : bundlePath;
        const debugOptions = { execArgv: ['--nolazy', '--inspect=6600'] };
        // If the extension is launched in debug mode, then the debug server options are used.
        const serverOptions: ServerOptions = {
            run: { module: bundlePath, transport: TransportKind.ipc },
            // In debug mode, use the non-bundled code if it's present. The production
            // build includes only the bundled package, so we don't want to crash if
            // someone starts the production extension in debug mode.
            debug: {
                module: modulePath,
                transport: TransportKind.ipc,
                options: debugOptions
            }
        };
        const vscodeLanguageClient = require('vscode-languageclient') as typeof import('vscode-languageclient');
        return new vscodeLanguageClient.LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}
