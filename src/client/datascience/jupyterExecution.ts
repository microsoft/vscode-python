// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';

import { ExecutionResult, IPythonExecutionFactory, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { ILogger } from '../common/types';
import { EXTENSION_ROOT_DIR } from '../constants';
import { ICondaService, IInterpreterService, InterpreterType } from '../interpreter/contracts';
import { IJupyterExecution, JupyterServerInfo } from './types';

@injectable()
export class JupyterExecution implements IJupyterExecution {
    constructor(@inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
                @inject(ICondaService) private condaService: ICondaService,
                @inject(IInterpreterService) private interpreterService: IInterpreterService,
                @inject(ILogger) private logger: ILogger) {
    }

    public getJupyterServerInfo = async () : Promise<JupyterServerInfo[]> => {
        const newOptions: SpawnOptions = {mergeStdOutErr: true};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);

        // We have a small python file here that we will execute to get the server info from all running Jupyter instances
        const pythonService = await this.executionFactory.create({});
        const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getServerInfo.py');
        const serverInfoString = await pythonService.exec([file], newOptions);

        let serverInfos: JupyterServerInfo[];
        try {
            // Parse out our results, return undefined if we can't suss it out
            serverInfos = JSON.parse(serverInfoString.stdout.trim()) as JupyterServerInfo[];
        } catch (err) {
            return undefined;
        }
        return serverInfos;
    }

    public execModuleObservable = async (args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> => {
        const newOptions = {...options};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);
        const pythonService = await this.executionFactory.create({});
        return pythonService.execModuleObservable('jupyter', args, newOptions);
    }
    public execModule = async (args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> => {
        const newOptions = {...options};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);
        const pythonService = await this.executionFactory.create({});
        return pythonService.execModule('jupyter', args, newOptions);
    }

    public isNotebookSupported = async (): Promise<boolean> => {
        // Spawn jupyter notebook --version and see if it returns something
        try {
            const result = await this.execModule(['notebook', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    public isImportSupported = async (): Promise<boolean> => {
        // Spawn jupyter nbconvert --version and see if it returns something
        try {
            const result = await this.execModule(['nbconvert', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    /**
     * Conda needs specific paths and env vars set to be happy. Call this function to fix up
     * (or created if not present) our environment to run jupyter
     */
    // Base Node.js SpawnOptions uses any for environment, so use that here as well
    // tslint:disable-next-line:no-any
    private fixupCondaEnv = async (inputEnv: any | undefined): Promise<any> => {
        if (!inputEnv) {
            inputEnv = process.env;
        }
        const interpreter = await this.interpreterService.getActiveInterpreter();
        if (interpreter && interpreter.type === InterpreterType.Conda) {
            return this.condaService.getActivatedCondaEnvironment(interpreter, inputEnv);
        }

        return inputEnv;
    }
}
