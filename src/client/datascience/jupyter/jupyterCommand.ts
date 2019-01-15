// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { PythonInterpreter, IInterpreterService } from "../../interpreter/contracts";
import { SpawnOptions } from "child_process";
import { ObservableExecutionResult, ExecutionResult, IProcessService, IProcessServiceFactory, IPythonExecutionFactory, IPythonExecutionService } from "../../common/process/types";
import { IServiceContainer } from "../../ioc/types";
import { IEnvironmentActivationService } from "../../interpreter/activation/types";
import { IJupyterCommandFactory, IJupyterCommand } from "../types";
import { injectable, inject } from "inversify";


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

    public async mainVersion(): Promise<number> {
        const interpreter = await this.interpreterPromise;
        if (interpreter && interpreter.version) {
            return interpreter.version.major;
        } else {
            return this.execVersion();
        }
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

    private async execVersion(): Promise<number> {
        const launcher = await this.launcherPromise;
        if (launcher) {
            const output = await launcher.exec(this.exe, ['--version'], { throwOnStdErr: false, encoding: 'utf8' });
            // First number should be our result
            const matches = /.*(\d+).*/m.exec(output.stdout);
            if (matches && matches.length > 1) {
                return parseInt(matches[1], 10);
            }
        }
        return 0;
    }

    private fixupEnv(env: NodeJS.ProcessEnv) : Promise<NodeJS.ProcessEnv> {
        if (this.activationHelper) {
            return this.activationHelper.getActivatedEnvironmentVariables(null)
        }

        return Promise.resolve(process.env);
    }

}

class InterpreterJupyterCommand implements IJupyterCommand {
    private exe: string;
    private requiredArgs: string[];
    private interpreterPromise: Promise<PythonInterpreter | undefined>;
    private pythonLauncher: Promise<IPythonExecutionService>;

    constructor(args: string[], pythonExecutionFactory: IPythonExecutionFactory, interpreter: PythonInterpreter) {
        this.exe = interpreter.path;
        this.requiredArgs = args;
        this.interpreterPromise = Promise.resolve(interpreter);
        this.pythonLauncher = pythonExecutionFactory.createActivatedEnvironment(null, interpreter);
    }

    public async mainVersion(): Promise<number> {
        const interpreter = await this.interpreterPromise;
        if (interpreter && interpreter.version) {
            return interpreter.version.major;
        } else {
            return this.execVersion();
        }
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

    private async execVersion(): Promise<number> {
        const launcher = await this.pythonLauncher;
        if (launcher) {
            const output = await launcher.exec(['--version'], { throwOnStdErr: false, encoding: 'utf8' });
            // First number should be our result
            const matches = /.*(\d+).*/m.exec(output.stdout);
            if (matches && matches.length > 1) {
                return parseInt(matches[1], 10);
            }
        }
        return 0;
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

    createInterpreterCommand(args: string[], interpreter: PythonInterpreter): IJupyterCommand {
        return new InterpreterJupyterCommand(args, this.executionFactory, interpreter)
    }

    createProcessCommand(exe: string, args: string[]): IJupyterCommand {
        return new ProcessJupyterCommand(exe, args, this.processServiceFactory, this.activationHelper, this.interpreterService);
    }


}
