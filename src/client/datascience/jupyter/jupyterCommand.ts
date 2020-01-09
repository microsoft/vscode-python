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
            return pythonExecutionFactory.createActivatedEnvironment({ interpreter: this._interpreter, bypassCondaExecution: true });
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

/**
 * This class is used to handle kernelspecs.
 * I.e. anything to do with the command `python -m jupyter kernelspec`.
 *
 * @class InterpreterJupyterKernelSpecCommand
 * @implements {IJupyterCommand}
 */
// tslint:disable-next-line: max-classes-per-file
export class InterpreterJupyterKernelSpecCommand extends InterpreterJupyterCommand {
    constructor(moduleName: string, args: string[], pythonExecutionFactory: IPythonExecutionFactory, interpreter: PythonInterpreter, isActiveInterpreter: boolean) {
        super(moduleName, args, pythonExecutionFactory, interpreter, isActiveInterpreter);
    }

    /**
     * Kernelspec subcommand requires special treatment.
     * Its possible the sub command hasn't been registered (i.e. jupyter kernelspec command hasn't been installed).
     * However its possible the kernlspec modules are available.
     * So here's what we have:
     * - python -m jupyter kernelspec --version (throws an error, as kernelspect sub command not installed)
     * - `import jupyter_client.kernelspec` (works, hence kernelspec modules are available)
     * - Problem is daemon will say that `kernelspec` is avaiable, as daemon can work with the `jupyter_client.kernelspec`.
     *   But rest of extension will assume kernelspec is available and `python -m jupyter kenerlspec --version` will fall over.
     * Solution:
     * - Run using daemon wrapper code if possible (we don't know whether daemon or python process will run kernel spec).
     * - Now, its possible the python daemon process is busy in which case we fall back (in daemon wrapper) to using a python process to run the code.
     * - However `python -m jupyter kernelspec` will fall over (as such a sub command hasn't been installed), hence calling daemon code will fail.
     * - What we do in such an instance is run the python code `python xyz.py` to deal with kernels.
     *   If that works, great.
     *   If that fails, then we know that `kernelspec` sub command doesn't exist and `import jupyter_client.kernelspec` also doesn't work.
     *   In such a case re-throw the exception from the first execution (possibly the daemon wrapper).
     * @param {string[]} args
     * @param {SpawnOptions} options
     * @returns {Promise<ExecutionResult<string>>}
     * @memberof InterpreterJupyterKernelSpecCommand
     */
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        let exception: Error | undefined;
        let output: ExecutionResult<string> = { stdout: '' };
        try {
            output = await super.exec(args, options);
        } catch (ex) {
            exception = ex;
        }

        if (!output.stderr && !exception) {
            return output;
        }

        // We're only interested in `python -m jupyter kernelspec list --json`
        const interpreter = await this.interpreter();
        if (
            !interpreter ||
            this.moduleName.toLowerCase() !== 'jupyter' ||
            this.args.join(' ').toLowerCase() !== `-m jupyter ${JupyterCommands.KernelSpecCommand}`.toLowerCase() ||
            args.join(' ').toLowerCase() !== 'list --json'
        ) {
            if (exception) {
                throw exception;
            }
            return output;
        }
        try {
            // Try getting kernels using python script, if that fails (even if there's output in stderr) rethrow original exception.
            const activatedEnv = await this.pythonExecutionFactory.createActivatedEnvironment({ interpreter, bypassCondaExecution: true });
            return activatedEnv.exec([path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterKernels.py')], { ...options, throwOnStdErr: true });
        } catch (innerEx) {
            traceError('Failed to get a list of the kernelspec using python script', innerEx);
            // Rethrow original exception.
            if (exception) {
                throw exception;
            }
            return output;
        }
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
        } else if (command === JupyterCommands.KernelSpecCommand) {
            return new InterpreterJupyterKernelSpecCommand(moduleName, args, this.executionFactory, interpreter, isActiveInterpreter);
        }
        return new InterpreterJupyterCommand(moduleName, args, this.executionFactory, interpreter, isActiveInterpreter);
    }

    public createProcessCommand(exe: string, args: string[]): IJupyterCommand {
        return new ProcessJupyterCommand(exe, args, this.processServiceFactory, this.activationHelper, this.interpreterService);
    }
}
