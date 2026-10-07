// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { WorkspaceConfiguration } from 'vscode';
import { ExecutableOptions, LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import { EXTENSION_ROOT_DIR, PYTHON_LANGUAGE } from '../../common/constants';
import { Resource } from '../../common/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ILanguageClientFactory } from '../types';

const languageClientName = 'Python Jedi';

export class JediLanguageClientFactory implements ILanguageClientFactory {
    constructor(
        private interpreterService: IInterpreterService,
        private readonly workspaceConfiguration: WorkspaceConfiguration,
    ) {}

    public async createLanguageClient(
        resource: Resource,
        _interpreter: PythonEnvironment | undefined,
        clientOptions: LanguageClientOptions,
    ): Promise<LanguageClient> {
        // Just run the language server using a module
        const lsScriptPath = path.join(EXTENSION_ROOT_DIR, 'python_files', 'run-jedi-language-server.py');
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        const useJediInEnv = this.workspaceConfiguration.get<boolean>('jedi.useJediInEnvPath') === true;
        const envVars: NodeJS.ProcessEnv = {
            USE_JEDI_IN_ENV: useJediInEnv ? '1' : '0',
            ...process.env,
        };
        const executableOptions: ExecutableOptions = { env: envVars };
        const serverOptions: ServerOptions = {
            command: interpreter ? interpreter.path : 'python',
            args: [lsScriptPath],
            options: executableOptions,
        };

        return new LanguageClient(PYTHON_LANGUAGE, languageClientName, serverOptions, clientOptions);
    }
}
