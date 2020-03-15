// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import { CondaEnvironmentInfo } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService, PythonExecutionInfo } from './types';

@injectable()
export class CondaExecutionService extends PythonExecutionService {
    constructor(
        serviceContainer: IServiceContainer,
        procService: IProcessService,
        pythonPath: string,
        private readonly condaFile: string,
        private readonly condaEnvironment: CondaEnvironmentInfo
    ) {
        super(serviceContainer, procService, pythonPath);
    }

    public getExecutionInfo(args: string[]): PythonExecutionInfo {
        const executionArgs =
            this.condaEnvironment.name !== '' ? ['-n', this.condaEnvironment.name] : ['-p', this.condaEnvironment.path];

        return { command: this.condaFile, args: ['run', ...executionArgs, 'python', ...args] };
    }
}
