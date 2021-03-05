// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { Resource } from '../../common/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ILanguageClientFactory } from '../types';

const languageClientName = 'Python Tools';

@injectable()
export class JediLanguageClientFactory implements ILanguageClientFactory {
    constructor(@inject(IInterpreterService) private interpreterService: IInterpreterService) {}

    public async createLanguageClient(
        resource: Resource,
        _interpreter: PythonEnvironment | undefined,
        clientOptions: LanguageClientOptions,
    ): Promise<LanguageClient> {
        // Just run the language server using a module
        const lsScriptPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'runJediLanguageServer.py');
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        const serverOptions: ServerOptions = {
            command: interpreter ? interpreter.path : 'python',
            args: [lsScriptPath],
        };

        // eslint-disable-next-line global-require
        const vscodeLanguageClient = require('vscode-languageclient/node') as typeof import('vscode-languageclient/node'); // NOSONAR
        return new vscodeLanguageClient.LanguageClient(
            PYTHON_LANGUAGE,
            languageClientName,
            serverOptions,
            clientOptions,
        );
    }
}
