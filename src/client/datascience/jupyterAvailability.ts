// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IPythonExecutionFactory } from '../common/process/types';
import { IJupyterExecution } from './types';
import { ExecutionResult, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { IPlatformService } from '../common/platform/types';
import { IConfigurationService } from '../common/types';
import { ICondaService } from '../interpreter/contracts';

@injectable()
export class JupyterExecution implements IJupyterExecution {

    constructor(@inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
                @inject(IPlatformService) private platformService: IPlatformService,
                @inject(IConfigurationService) private configuration: IConfigurationService,
                @inject(ICondaService) private condaService: ICondaService) {
    }

    public execModuleObservable = async (args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> => {
        const newOptions = await this.fixupCondaEnv(options);
        const pythonService = await this.executionFactory.create({});
        return pythonService.execModuleObservable('jupyter', args, newOptions);
    }
    public execModule = async (args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> => {
        const newOptions = await this.fixupCondaEnv(options);
        const pythonService = await this.executionFactory.create({});
        return pythonService.execModule('jupyter', args, newOptions);
    }

    public isNotebookSupported = async (): Promise<boolean> => {
        // Spawn jupyter notebook --version and see if it returns something
        try {
            const result = await this.execModule(['notebook', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch {
            return false;
        }
    }

    public isImportSupported = async (): Promise<boolean> => {
        // Spawn jupyter nbconvert --version and see if it returns something
        try {
            const result = await this.execModule(['nbconvert', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch {
            return false;
        }
    }

    private fixupCondaEnv = async (inputOptions: SpawnOptions): Promise<SpawnOptions> => {
        const settings = this.configuration.getSettings();
        const condaEnv = await this.condaService.getCondaEnvironment(settings.pythonPath);
        if (condaEnv) {
            if (this.platformService.isWindows) {
                const scriptsPath = condaEnv.path.concat('\\Scripts\\;');
                let newOptions = {...inputOptions};
                if (newOptions.env && newOptions.env.Path) {
                    newOptions.env.Path = scriptsPath.concat(newOptions.env.Path); 
                } else {
                    newOptions.env = process.env;
                    newOptions.env.Path = scriptsPath.concat(newOptions.env.Path); 
                }
                return newOptions;
            }
        }
        return inputOptions;
    }
}
