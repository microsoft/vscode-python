// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import { CondaEnvironmentInfo } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { PythonExecutionService } from './pythonProcess';
import { IProcessService, IPythonExecutableInfo } from './types';

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

    public getExecutableInfo(command: string, args: string[]): IPythonExecutableInfo {
        if (this.condaEnvironment.name !== '') {
            return {
                command: this.condaFile,
                args: ['run', '-n', this.condaEnvironment.name, 'python', ...args]
            };
        }
        if (this.condaEnvironment.path.length > 0) {
            return {
                command: this.condaFile,
                args: ['run', '-p', this.condaEnvironment.path, 'python', ...args]
            };
        }
        return { command, args };
    }
}
