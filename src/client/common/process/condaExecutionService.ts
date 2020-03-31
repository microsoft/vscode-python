// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import { CondaEnvironmentInfo } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService } from './types';

@injectable()
export class CondaExecutionService extends PythonExecutionService {
    private readonly envArgs: string[];
    private readonly runArgs: string[];
    constructor(
        serviceContainer: IServiceContainer,
        procService: IProcessService,
        pythonPath: string,
        private readonly condaFile: string,
        private readonly condaEnvironment: CondaEnvironmentInfo
    ) {
        super(serviceContainer, procService, pythonPath);
        if (this.condaEnvironment.name === '') {
            this.envArgs = ['-p', this.condaEnvironment.path];
        } else {
            this.envArgs = ['-n', this.condaEnvironment.name];
        }
        this.runArgs = ['run', ...this.envArgs];
    }

    protected getPythonArgv(): string[] {
        return [this.condaFile, ...this.runArgs, 'python'];
    }
}
