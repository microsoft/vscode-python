// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    ExecutionFactoryCreationOptions,
    ExecutionFactoryCreateWithEnvironmentOptions,
    IProcessService,
} from '../../../../client/common/process/types';

export class TestPythonExecutionFactory implements IPythonExecutionFactory {
    constructor(private readonly proc: IPythonExecutionService) {}

    create(_options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        return Promise.resolve(this.proc);
    }

    createActivatedEnvironment(
        _options: ExecutionFactoryCreateWithEnvironmentOptions,
    ): Promise<IPythonExecutionService> {
        return Promise.resolve(this.proc);
    }

    createCondaExecutionService(
        _pythonPath: string,
        _processService?: IProcessService,
        _resource?: Uri,
    ): Promise<IPythonExecutionService | undefined> {
        return Promise.resolve(this.proc);
    }
}
