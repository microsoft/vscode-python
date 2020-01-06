// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { SpawnOptions } from 'child_process';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { traceError } from '../../common/logger';
import { ExecutionResult, IProcessService, IProcessServiceFactory, IPythonExecutionFactory, IPythonExecutionService, ObservableExecutionResult } from '../../common/process/types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { JupyterCommands, PythonDaemonModule } from '../constants';
import { IJupyterCommand, IJupyterCommandFactory } from '../types';

// JupyterCommand objects represent some process that can be launched that should be guaranteed to work because it
// was found by testing it previously
class ProcessJupyterCommand implements IJupyterCommand {
    private exe: string;
    private requiredArgs: string[];
    private launcherPromise: Promise<IProcessService>;
    private interpreterPromise: Promise<PythonInterpreter | undefined>;
    private activationHelper: IEnvironmentActivationService;

    constructor(
        exe: string,
        args: string[],
        processServiceFactory: IProcessServiceFactory,
        activationHelper: IEnvironmentActivationService,
        interpreterService: IInterpreterService
    ) {
        this.exe = exe;
        this.requiredArgs = args;
        this.launcherPromise = processServiceFactory.create();
        this.activationHelper = activationHelper;
        this.interpreterPromise = interpreterService.getInterpreterDetails(this.exe).catch(_e => undefined);
    }

    public interpreter(): Promise<PythonInterpreter | undefined> {
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

    private fixupEnv(_env?: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv | undefined> {
        if (this.activationHelper) {
            return this.activationHelper.getActivatedEnvironmentVariables(undefined);
        }

        return Promise.resolve(process.env);
    }
}

class InterpreterJupyterCommand implements IJupyterCommand {
    protected interpreterPromise: Promise<PythonInterpreter | undefined>;
    private pythonLauncher: Promise<IPythonExecutionService>;

    constructor(
        protected readonly moduleName: string,
        protected args: string[],
        protected readonly pythonExecutionFactory: IPythonExecutionFactory,
        private readonly _interpreter: PythonInterpreter,
        isActiveInterpreter: boolean
    ) {
        this.interpreterPromise = Promise.resolve(this._interpreter);
        this.pythonLauncher = this.interpreterPromise.then(async interpreter => {
            // Create a daemon only if the interpreter is the same as the current interpreter.
            // We don't want too many daemons (we don't want one for each of the users interpreter on their machine).
            if (isActiveInterpreter) {
                const svc = await pythonExecutionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter!.path });

                // If we're using this command to start notebook, then ensure the daemon can start a notebook inside it.
                if (
                    (moduleName.toLowerCase() === 'jupyter' &&
                        args
                            .join(' ')
                            .toLowerCase()
                            .startsWith('-m jupyter notebook')) ||
                    (moduleName.toLowerCase() === 'notebook' &&
                        args
                            .join(' ')
                            .toLowerCase()
                            .startsWith('-m notebook'))
                ) {
                    try {
                        const output = await svc.exec([path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'jupyter_nbInstalled.py')], {});
                        if (output.stdout.toLowerCase().includes('available')) {
                            return svc;
                        }
                    } catch (ex) {
                        traceError('Checking whether notebook is importable failed', ex);
                    }
                }
            }
            return pythonExecutionFactory.createActivatedEnvironment({ interpreter: this._interpreter });
        });
    }
    public interpreter(): Promise<PythonInterpreter | undefined> {
        return this.interpreterPromise;
    }

    public async execObservable(args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> {
        const newOptions = { ...options };
        const launcher = await this.pythonLauncher;
        const newArgs = [...this.args, ...args];
        const moduleName = newArgs[1];
        newArgs.shift(); // Remove '-m'
        newArgs.shift(); // Remove module name
        return launcher.execModuleObservable(moduleName, newArgs, newOptions);
    }

    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const newOptions = { ...options };
        const launcher = await this.pythonLauncher;
        const newArgs = [...this.args, ...args];
        const moduleName = newArgs[1];
        newArgs.shift(); // Remove '-m'
        newArgs.shift(); // Remove module name
        return launcher.execModule(moduleName, newArgs, newOptions);
    }
}

/**
 * This class is used to launch the notebook.
 * I.e. anything to do with the command `python -m jupyter notebook` or `python -m notebook`.
 *
 * @class InterpreterJupyterNotebookCommand
 * @implements {IJupyterCommand}
 */
export class InterpreterJupyterNotebookCommand extends InterpreterJupyterCommand {
    constructor(moduleName: string, args: string[], pythonExecutionFactory: IPythonExecutionFactory, interpreter: PythonInterpreter, isActiveInterpreter: boolean) {
        super(moduleName, args, pythonExecutionFactory, interpreter, isActiveInterpreter);
    }
}

// tslint:disable-next-line: max-classes-per-file
@injectable()
export class JupyterCommandFactory implements IJupyterCommandFactory {
    constructor(
        @inject(IPythonExecutionFactory) private readonly executionFactory: IPythonExecutionFactory,
        @inject(IEnvironmentActivationService) private readonly activationHelper: IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
    ) {}

    public createInterpreterCommand(command: JupyterCommands, moduleName: string, args: string[], interpreter: PythonInterpreter, isActiveInterpreter: boolean): IJupyterCommand {
        if (command === JupyterCommands.NotebookCommand) {
            return new InterpreterJupyterNotebookCommand(moduleName, args, this.executionFactory, interpreter, isActiveInterpreter);
        }
        return new InterpreterJupyterCommand(moduleName, args, this.executionFactory, interpreter, isActiveInterpreter);
    }

    public createProcessCommand(exe: string, args: string[]): IJupyterCommand {
        return new ProcessJupyterCommand(exe, args, this.processServiceFactory, this.activationHelper, this.interpreterService);
    }
}
