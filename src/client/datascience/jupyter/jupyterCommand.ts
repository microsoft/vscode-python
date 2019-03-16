// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { SpawnOptions } from 'child_process';
import { inject, injectable } from 'inversify';

import {
    ExecutionResult,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService,
    ObservableExecutionResult
} from '../../common/process/types';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterCommand, IJupyterCommandFactory } from '../types';

// JupyterCommand objects represent some process that can be launched that should be guaranteed to work because it
// was found by testing it previously
class ProcessJupyterCommand implements IJupyterCommand {
    private exe: string;
    private requiredArgs: string[];
    private launcherPromise: Promise<IProcessService>;
    private interpreterPromise: Promise<PythonInterpreter | undefined>;
    private activationHelper: IEnvironmentActivationService;

    constructor(exe: string, args: string[], processServiceFactory: IProcessServiceFactory, activationHelper: IEnvironmentActivationService, interpreterService: IInterpreterService) {
        this.exe = exe;
        this.requiredArgs = args;
        this.launcherPromise = processServiceFactory.create();
        this.activationHelper = activationHelper;
        this.interpreterPromise = interpreterService.getInterpreterDetails(this.exe).catch(e => undefined);
    }

    public interpreter() : Promise<PythonInterpreter | undefined> {
        return this.interpreterPromise;
    }

    public async execObservable(args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> {
        const newOptions = { ...options };
        newOptions.env = await this.fixupEnv(newOptions.env);
        const launcher = await this.launcherPromise;
        const newArgs = [...this.requiredArgs, ...args];
        return launcher.execObservable(this.exe, newArgs, newOptions);
    }

    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const newOptions = { ...options };
        newOptions.env = await this.fixupEnv(newOptions.env);
        const launcher = await this.launcherPromise;
        const newArgs = [...this.requiredArgs, ...args];
        return launcher.exec(this.exe, newArgs, newOptions);
    }

    private fixupEnv(env: NodeJS.ProcessEnv) : Promise<NodeJS.ProcessEnv | undefined> {
        if (this.activationHelper) {
            return this.activationHelper.getActivatedEnvironmentVariables(undefined);
        }

        return Promise.resolve(process.env);
    }

}

class InterpreterJupyterCommand implements IJupyterCommand {
    private requiredArgs: string[];
    private interpreterPromise: Promise<PythonInterpreter | undefined>;
    private pythonLauncher: Promise<IPythonExecutionService>;

    constructor(args: string[], pythonExecutionFactory: IPythonExecutionFactory, interpreter: PythonInterpreter) {
        this.requiredArgs = args;
        this.interpreterPromise = Promise.resolve(interpreter);
        this.pythonLauncher = pythonExecutionFactory.createActivatedEnvironment({ resource: undefined, interpreter, allowEnvironmentFetchExceptions: true });
    }

    public interpreter() : Promise<PythonInterpreter | undefined> {
        return this.interpreterPromise;
    }

    public async execObservable(args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> {
        const newOptions = { ...options };
        const launcher = await this.pythonLauncher;
        const newArgs = [...this.requiredArgs, ...args];
        return launcher.execObservable(newArgs, newOptions);
    }

    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const newOptions = { ...options };
        const launcher = await this.pythonLauncher;
        const newArgs = [...this.requiredArgs, ...args];
        return launcher.exec(newArgs, newOptions);
    }
}

@injectable()
export class JupyterCommandFactory implements IJupyterCommandFactory {

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IEnvironmentActivationService) private activationHelper : IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(IInterpreterService) private interpreterService: IInterpreterService
    ) {

    }

    public createInterpreterCommand(args: string[], interpreter: PythonInterpreter): IJupyterCommand {
        return new InterpreterJupyterCommand(args, this.executionFactory, interpreter);
    }

    public createProcessCommand(exe: string, args: string[]): IJupyterCommand {
        return new ProcessJupyterCommand(exe, args, this.processServiceFactory, this.activationHelper, this.interpreterService);
    }
}
