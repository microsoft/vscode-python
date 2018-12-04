// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, ServerConnection, SessionManager } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import * as uuid from 'uuid/v4';
import { CancellationToken, Disposable } from 'vscode-jsonrpc';

import { Cancellation } from '../common/cancellation';
import { IFileSystem, TemporaryDirectory } from '../common/platform/types';
import {
    ExecutionResult,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    ObservableExecutionResult,
    SpawnOptions
} from '../common/process/types';
import { IDisposableRegistry, ILogger } from '../common/types';
import { IS_WINDOWS } from '../common/util';
import * as localize from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../constants';
import {
    ICondaService,
    IInterpreterService,
    IKnownSearchPathsForInterpreters,
    InterpreterType,
    PythonInterpreter
} from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { JupyterConnection, JupyterServerInfo } from './jupyterConnection';
import { IConnection, IJupyterExecution, IJupyterKernelSpec, INotebookServer } from './types';

const CheckJupyterRegEx = IS_WINDOWS ? /^jupyter?\.exe$/ : /^jupyter?$/;
const NotebookCommand = 'notebook';
const ConvertCommand = 'nbconvert';
const KernelSpecCommand = 'kernelspec';
const KernelCreateCommand = 'ipykernel';
const PyKernelOutputRegEx = /.*\s+(.+)$/m;
const KernelSpecOutputRegEx = /^\s*(\S+)\s+(\S+)$/;
const IsGuidRegEx = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class JupyterKernelSpec implements IJupyterKernelSpec {
    public name: string;
    public language: string;
    public path: string;
    public specFile: string | undefined;
    constructor(specModel : Kernel.ISpecModel, file?: string) {
        this.name = specModel.name;
        this.language = specModel.language;
        this.path = specModel.argv.length > 0 ? specModel.argv[0] : '';
        this.specFile = file;
    }
    public dispose = () => {
        if (this.specFile && IsGuidRegEx.test(path.basename(path.dirname(this.specFile)))) {
            fs.removeSync(path.dirname(this.specFile));
            this.specFile = undefined;
        }
    }
}

// JupyterCommand objects represent some process that can be launched that should be guaranteed to work because it
// was found by testing it previously
class JupyterCommand {
    private exe: string;
    private requiredArgs: string[];
    private launcher: IProcessService;
    private interpreterPromise: Promise<PythonInterpreter | undefined>;
    private condaService: ICondaService;

    constructor(exe: string, args: string[], launcher: IProcessService, interpreter: IInterpreterService, condaService: ICondaService) {
        this.exe = exe;
        this.requiredArgs = args;
        this.launcher = launcher;
        this.condaService = condaService;
        this.interpreterPromise = interpreter.getInterpreterDetails(this.exe).catch(e => undefined);
    }

    public mainVersion = async () : Promise<number> => {
        const interpreter = await this.interpreterPromise;
        if (interpreter) {
            return interpreter.version_info[0];
        } else {
            return this.execVersion();
        }
    }

    public execObservable = async (args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> => {
        const newOptions = {...options};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);
        const newArgs = [...this.requiredArgs, ...args];
        return this.launcher.execObservable(this.exe, newArgs, newOptions);
    }

    public exec = async (args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> => {
        const newOptions = {...options};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);
        const newArgs = [...this.requiredArgs, ...args];
        return this.launcher.exec(this.exe, newArgs, newOptions);
    }

    /**
     * Conda needs specific paths and env vars set to be happy. Call this function to fix up
     * (or created if not present) our environment to run jupyter
     */
    // Base Node.js SpawnOptions uses any for environment, so use that here as well
    // tslint:disable-next-line:no-any
    private fixupCondaEnv = async (inputEnv?: NodeJS.ProcessEnv): Promise<any> => {
        if (!inputEnv) {
            inputEnv = process.env;
        }
        const interpreter = await this.interpreterPromise;

        if (interpreter && interpreter.type === InterpreterType.Conda) {
            return this.condaService.getActivatedCondaEnvironment(interpreter, inputEnv);
        }

        return inputEnv;
    }

    private execVersion = async () : Promise<number> => {
        if (this.launcher) {
            const output = await this.launcher.exec(this.exe, ['--version'], {throwOnStdErr: false, encoding: 'utf8'});
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
export class JupyterExecution implements IJupyterExecution, Disposable {

    private processServicePromise: Promise<IProcessService>;
    private commands : {[command: string] : JupyterCommand } = {};
    private jupyterPath : string | undefined;
    private usablePythonInterpreterPromise : Promise<PythonInterpreter | undefined> | undefined;

    constructor(@inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
                @inject(ICondaService) private condaService: ICondaService,
                @inject(IInterpreterService) private interpreterService: IInterpreterService,
                @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
                @inject(IKnownSearchPathsForInterpreters) private knownSearchPaths: IKnownSearchPathsForInterpreters,
                @inject(ILogger) private logger: ILogger,
                @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
                @inject(IFileSystem) private fileSystem: IFileSystem,
                @inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.processServicePromise = this.processServiceFactory.create();
        this.disposableRegistry.push(this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged));
        this.disposableRegistry.push(this);
    }

    public dispose = () => {
        // Clear our usableJupyterInterpreter
        this.usablePythonInterpreterPromise = undefined;
    }

    public isNotebookSupported = (cancelToken?: CancellationToken): Promise<boolean> => {
        // See if we can find the command notebook
        return Cancellation.race(() => this.isCommandSupported(NotebookCommand, cancelToken), cancelToken);
    }

    public getUsableJupyterPython = (cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> => {
        // Only try to compute this once.
        if (!this.usablePythonInterpreterPromise) {
            this.usablePythonInterpreterPromise = Cancellation.race(() => this.getUsableJupyterPythonImpl(cancelToken), cancelToken);
        }
        return this.usablePythonInterpreterPromise;
    }

    public isImportSupported = async (cancelToken?: CancellationToken): Promise<boolean> => {
        // See if we can find the command nbconvert
        return Cancellation.race(() => this.isCommandSupported(ConvertCommand), cancelToken);
    }

    public isKernelCreateSupported = async (cancelToken?: CancellationToken): Promise<boolean> => {
        // See if we can find the command ipykernel
        return Cancellation.race(() => this.isCommandSupported(KernelCreateCommand), cancelToken);
    }

    public isKernelSpecSupported = async (cancelToken?: CancellationToken): Promise<boolean> => {
        // See if we can find the command kernelspec
        return Cancellation.race(() => this.isCommandSupported(KernelSpecCommand), cancelToken);
    }

    public connectToNotebookServer = (uri?: string, cancelToken?: CancellationToken) : Promise<INotebookServer | undefined> => {
        // Return nothing if we cancel
        return Cancellation.race(async () => {
            let connection: IConnection;
            let kernelSpec: IJupyterKernelSpec | undefined;

            // If our uri is undefined or if it's set to local launch we need to launch a server locally
            if (!uri) {
                const launchResults = await this.startNotebookServer(cancelToken);
                if (launchResults) {
                    connection = launchResults.connection;
                    kernelSpec = launchResults.kernelSpec;
                } else {
                    throw new Error(localize.DataScience.jupyterNotebookFailure().format(''));
                }
            } else {
                // If we have a URI spec up a connection info for it
                connection = this.createRemoteConnectionInfo(uri);
                kernelSpec = undefined;
            }

            try {
                // If we don't have a kernel spec yet, check using our current connection
                if (!kernelSpec) {
                    kernelSpec = await this.getMatchingKernelSpec(connection, cancelToken);
                }

                // If still not found, throw an error
                if (!kernelSpec) {
                    throw new Error(localize.DataScience.jupyterKernelSpecNotFound());
                }

                // Try to connect to our jupyter process
                const result = this.serviceContainer.get<INotebookServer>(INotebookServer);
                this.disposableRegistry.push(result);
                await result.connect(connection, kernelSpec);
                return result;
            } catch (err) {
                // Something else went wrong
                throw new Error(localize.DataScience.jupyterNotebookConnectFailed().format(connection.baseUrl));
            }

        }, cancelToken);
    }

    public spawnNotebook = async (file: string) : Promise<void> => {
        // First we find a way to start a notebook server
        const notebookCommand = await this.findBestCommand('notebook');
        if (!notebookCommand) {
            throw new Error(localize.DataScience.jupyterNotSupported());
        }

        const args: string [] = [`--NotebookApp.file_to_run=${file}`];

        // Don't wait for the exec to finish and don't dispose. It's up to the user to kill the process
        notebookCommand.exec(args, {throwOnStdErr: false, encoding: 'utf8'}).ignoreErrors();
    }

    public importNotebook = async (file: string, template: string) : Promise<string> => {
        // First we find a way to start a nbconvert
        const convert = await this.findBestCommand(ConvertCommand);
        if (!convert) {
            throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
        }

        // Wait for the nbconvert to finish
        const result = await convert.exec([file, '--to', 'python', '--stdout', '--template', template], { throwOnStdErr: false, encoding: 'utf8' });
        if (result.stderr) {
            // Stderr on nbconvert doesn't indicate failure. Just log the result
            this.logger.logInformation(result.stderr);
        }
        return result.stdout;
    }

    private async getMatchingKernelSpec(connection?: IConnection, cancelToken?: CancellationToken) : Promise<IJupyterKernelSpec | undefined> {
        // If not using an active connection, check on disk
        if (!connection) {
            // Get our best interpreter. We want its python path
            const bestInterpreter = await this.getUsableJupyterPython(cancelToken);

            // Enumerate our kernel specs that jupyter will know about and see if
            // one of them already matches based on path
            if (bestInterpreter && !await this.hasSpecPathMatch(bestInterpreter, cancelToken)) {

                // Nobody matches on path, so generate a new kernel spec
                if (await this.isKernelCreateSupported(cancelToken)) {
                    await this.addMatchingSpec(bestInterpreter, cancelToken);
                }
            }
        }

        // Now enumerate them again
        const enumerator = connection ? () => this.getActiveKernelSpecs(connection) : () => this.enumerateSpecs(cancelToken);

        // Then find our match
        return this.findSpecMatch(enumerator);
    }

    private createRemoteConnectionInfo = (uri: string): IConnection => {
        let url: URL;
        try {
            url = new URL(uri);
        } catch (err) {
            // This should already have been parsed when set, so just throw if it's not right here
            throw err;
        }

        return {
            baseUrl: `${url.protocol}//${url.host}${url.pathname}`,
            token: `${url.searchParams.get('token')}`,
            dispose: noop
        };
    }

    private startNotebookServer = async (cancelToken?: CancellationToken): Promise<{connection: IConnection; kernelSpec: IJupyterKernelSpec | undefined}> => {
        // First we find a way to start a notebook server
        const notebookCommand = await this.findBestCommand(NotebookCommand, cancelToken);
        if (!notebookCommand) {
            throw new Error(localize.DataScience.jupyterNotSupported());
        }

        // Now actually launch it
        try {
            // Generate a temp dir with a unique GUID, both to match up our started server and to easily clean up after
            const tempDir = await this.generateTempDir();
            this.disposableRegistry.push(tempDir);

            // Use this temp file to generate a list of args for our command
            const args: string [] = ['--no-browser', `--notebook-dir=${tempDir.path}`];

            // Before starting the notebook process, make sure we generate a kernel spec
            const kernelSpec = await this.getMatchingKernelSpec();

            // Then use this to launch our notebook process.
            const launchResult = await notebookCommand.execObservable(args, { throwOnStdErr: false, encoding: 'utf8', token: cancelToken});

            // Wait for the connection information on this result
            const connection = await JupyterConnection.waitForConnection(
                tempDir.path, this.getJupyterServerInfo, launchResult, this.serviceContainer, cancelToken);

            return {
                connection: connection,
                kernelSpec: kernelSpec
            };
        } catch (err) {
            // Something else went wrong
            throw new Error(localize.DataScience.jupyterNotebookFailure().format(err));
        }
    }

    private getUsableJupyterPythonImpl = async (cancelToken?: CancellationToken) : Promise<PythonInterpreter | undefined> => {

        // Make sure somebody is useable for notebooks. Otherwise it doesn't really matter
        // if somebody else can run ipykernel
        if (!(await this.isNotebookSupported(cancelToken))) {
            return undefined;
        }

        // Find the python interpreter that supports ipykernel that is closest
        // to our active interpreter
        const active = await this.interpreterService.getActiveInterpreter();
        if (active && await this.doesModuleExist(KernelCreateCommand, active, cancelToken)) {
            // The active interpreter is good enough. It supports ipykernel
            return active;
        } else if (active && active !== null) {
            // Go through the rest of them and see if anybody supports it. Score each based on
            // version numbers
            let bestScore = 0;
            let bestInterpreter;
            const list = await this.interpreterService.getInterpreters();
            for (let i = 0; i < list.length; i += 1) {
                let score = 0;
                // Don't check active again
                if (active !== list[i]) {
                    // First the interpreter has to support ipykernel
                    if (await this.doesModuleExist(KernelCreateCommand, list[i], cancelToken)) {
                        // This one at least works, give it a point.
                        score += 1;

                        // Then start matching based on version
                        if (list[i].version_info[0] === active.version_info[0]) {
                            score += 32;
                            if (list[i].version_info[1] === active.version_info[1]) {
                                score += 16;
                                if (list[i].version_info[2] === active.version_info[2]) {
                                    score += 8;
                                    if (list[i].version_info[3] === active.version_info[3]) {
                                        score += 4;
                                    }
                                }
                            }
                        }

                        // Also point for type
                        if (list[i].type === active.type) {
                            score += 1;
                        }
                    }
                }
                if (score > bestScore) {
                    bestInterpreter = list[i];
                    bestScore = score;
                }
            }

            return bestInterpreter;
        }

        return undefined;
    }

    private getJupyterServerInfo = async (cancelToken?: CancellationToken) : Promise<JupyterServerInfo[] | undefined> => {
        // We have a small python file here that we will execute to get the server info from all running Jupyter instances
        const bestInterpreter = await this.getUsableJupyterPython(cancelToken);
        if (bestInterpreter) {
            const newOptions: SpawnOptions = {mergeStdOutErr: true, token: cancelToken};
            newOptions.env = await this.fixupCondaEnv(newOptions.env, bestInterpreter);
                const processService = await this.processServiceFactory.create();
            const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getServerInfo.py');
            const serverInfoString = await processService.exec(bestInterpreter.path, [file], newOptions);

            let serverInfos: JupyterServerInfo[];
            try {
                // Parse out our results, return undefined if we can't suss it out
                serverInfos = JSON.parse(serverInfoString.stdout.trim()) as JupyterServerInfo[];
            } catch (err) {
                return undefined;
            }
            return serverInfos;
        }

        return undefined;
    }

    private onSettingsChanged = () : Promise<void> => {
        // Do the same thing as dispose so that we regenerate
        // all of our commands
        return Promise.resolve(this.dispose());
    }

    private async addMatchingSpec(bestInterpreter: PythonInterpreter, cancelToken?: CancellationToken) : Promise<void> {
        const displayName = localize.DataScience.historyTitle();
        const ipykernelCommand = await this.findBestCommand(KernelCreateCommand, cancelToken);

        // If this fails, then we just skip this spec
        try {
            // Run the ipykernel install command. This will generate a new kernel spec. However
            // it will be pointing to the python that ran it. We'll fix that up afterwards
            const name = uuid();
            if (ipykernelCommand) {
                const result = await ipykernelCommand.exec(['install', '--user', '--name', name, '--display-name', `'${displayName}'`], { throwOnStdErr: true, encoding: 'utf8', token: cancelToken });

                // Result should have our file name.
                const match = PyKernelOutputRegEx.exec(result.stdout);
                const diskPath = match && match !== null && match.length > 1 ? path.join(match[1], 'kernel.json') : await this.findSpecPath(name);

                // If that works, rewrite our active interpreter into the argv
                if (diskPath && bestInterpreter) {
                    if (await fs.pathExists(diskPath)) {
                        const specModel: Kernel.ISpecModel = await fs.readJSON(diskPath);
                        specModel.argv[0] = bestInterpreter.path;
                        await fs.writeJSON(diskPath, specModel, { flag: 'w', encoding: 'utf8' });

                        // This should automatically cleanup when the kernelspec is used
                    }
                }
            }
        } catch (err) {
            this.logger.logError(err);
        }
    }

    private findSpecPath = async (specName: string, cancelToken?: CancellationToken) : Promise<string | undefined> => {
        // Enumerate all specs and get path for the match
        const specs = await this.enumerateSpecs(cancelToken);
        const match = specs.find(s => {
            const js = s as JupyterKernelSpec;
            return js && js.name === specName;
        }) as JupyterKernelSpec;
        return match ? match.specFile : undefined;
    }

    private async generateTempDir() : Promise<TemporaryDirectory> {
        const resultDir = path.join(os.tmpdir(), uuid());
        await this.fileSystem.createDirectory(resultDir);

        return {
            path: resultDir,
            dispose: () => {
                // Try ten times. Process may still be up and running.
                // We don't want to do async as async dispose means it may never finish and then we don't
                // delete
                let count = 0;
                while (count < 10) {
                    try {
                        fs.removeSync(resultDir);
                        count = 10;
                    } catch {
                        count += 1;
                    }
                }
            }
        };
    }

    private isCommandSupported = async (command: string, cancelToken?: CancellationToken) : Promise<boolean> => {
        // See if we can find the command
        try {
            const result = await this.findBestCommand(command, cancelToken);
            return result !== undefined;
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
    private fixupCondaEnv = async (inputEnv: NodeJS.ProcessEnv, interpreter: PythonInterpreter): Promise<any> => {
        if (!inputEnv) {
            inputEnv = process.env;
        }
        if (interpreter && interpreter.type === InterpreterType.Conda) {
            return this.condaService.getActivatedCondaEnvironment(interpreter, inputEnv);
        }

        return inputEnv;
    }

    private hasSpecPathMatch = async (info: PythonInterpreter | undefined, cancelToken?: CancellationToken) : Promise<boolean> => {
        if (info) {
            // Enumerate our specs
            const specs = await this.enumerateSpecs(cancelToken);

            // See if any of their paths match
            return specs.findIndex(s => {
                if (info && s) {
                    return this.fileSystem.arePathsSame(s.path, info.path);
                }
                return false;
            }) >= 0;
        }

        // If no active interpreter, just act like everything is okay as we can't find a new spec anyway
        return true;
    }

    //tslint:disable-next-line:cyclomatic-complexity
    private findSpecMatch = async (enumerator: () => Promise<(IJupyterKernelSpec | undefined)[]>) : Promise<IJupyterKernelSpec | undefined> => {
        // Extract our current python information that the user has picked.
        // We'll match against this.
        const info = await this.interpreterService.getActiveInterpreter();
        let bestScore = 0;
        let bestSpec : IJupyterKernelSpec | undefined;

        // Then enumerate our specs
        const specs = await enumerator();

        // For each get its details as we will likely need them
        const specDetails = await Promise.all(specs.map(async s => {
            if (s && s.path.length > 0 && await fs.pathExists(s.path)) {
                return this.interpreterService.getInterpreterDetails(s.path);
            }
        }));

        for (let i = 0; specs && i < specs.length; i += 1) {
            const spec = specs[i];
            let score = 0;

            if (spec && spec.path.length > 0 && info && spec.path === info.path) {
                // Path match
                score += 10;
            }
            if (spec && spec.language.toLocaleLowerCase() === 'python') {
                // Language match
                score += 1;

                // See if the version is the same
                if (info && info.version_info && specDetails[i]) {
                    const details = specDetails[i];
                    if (details && details.version_info) {
                        if (details.version_info[0] === info.version_info[0]) {
                            // Major version match
                            score += 4;

                            if (details.version_info[1] === info.version_info[1]) {
                                // Minor version match
                                score += 2;

                                if (details.version_info[2] === info.version_info[2]) {
                                    // Minor version match
                                    score += 1;
                                }
                            }
                        }
                    }
                } else if (info && info.version_info && spec && spec.path.toLocaleLowerCase() === 'python') {
                    // This should be our current python.

                    // Search for a digit on the end of the name. It should match our major version
                    const match = /\D+(\d+)/.exec(spec.name);
                    if (match && match !== null && match.length > 0) {
                        // See if the version number matches
                        const nameVersion = parseInt(match[0], 10);
                        if (nameVersion && nameVersion === info.version_info[0]) {
                            score += 4;
                        }
                    }
                }
            }

            // Update high score
            if (score > bestScore) {
                bestScore = score;
                bestSpec = spec;
            }
        }

        // If still not set, at least pick the first one
        if (!bestSpec && specs && specs.length > 0) {
            bestSpec = specs[0];
        }

        return bestSpec;
    }

    private getActiveKernelSpecs = async (connection: IConnection) : Promise<IJupyterKernelSpec[]> => {
        // Use our connection to create a session manager
        const serverSettings = ServerConnection.makeSettings(
            {
                baseUrl: connection.baseUrl,
                token: connection.token,
                pageUrl: '',
                // A web socket is required to allow token authentication (what if there is no token authentication?)
                wsUrl: connection.baseUrl.replace('http', 'ws'),
                init: { cache: 'no-store', credentials: 'same-origin' }
            });
        const sessionManager = new SessionManager({ serverSettings: serverSettings });

        // Ask the session manager to refresh its list of kernel specs.
        await sessionManager.refreshSpecs();

        // Enumerate all of the kernel specs, turning each into a JupyterKernelSpec
        const kernelspecs = sessionManager.specs && sessionManager.specs.kernelspecs ? sessionManager.specs.kernelspecs : {};
        const keys = Object.keys(kernelspecs);
        return keys.map(k => {
            const spec = kernelspecs[k];
            return new JupyterKernelSpec(spec);
        });
    }

    private async readSpec(kernelSpecOutputLine: string) : Promise<JupyterKernelSpec | undefined> {
        const match = KernelSpecOutputRegEx.exec(kernelSpecOutputLine);
        if (match && match !== null && match.length > 2) {
            // Second match should be our path to the kernel spec
            const file = path.join(match[2], 'kernel.json');
            if (await fs.pathExists(file)) {
                // Turn this into a IJupyterKernelSpec
                const model = await fs.readJSON(file, { encoding: 'utf8' });
                model.name = match[1];
                return new JupyterKernelSpec(model, file);
            }
        }

        return undefined;
    }

    private enumerateSpecs = async (cancelToken?: CancellationToken) : Promise<(IJupyterKernelSpec | undefined)[]> => {
        if (await this.isKernelSpecSupported()) {
            const kernelSpecCommand = await this.findBestCommand(KernelSpecCommand);

            if (kernelSpecCommand) {
                // Ask for our current list.
                const list = await kernelSpecCommand.exec(['list'], { throwOnStdErr: true, encoding: 'utf8' });

                // This should give us back a key value pair we can parse
                const lines = list.stdout.splitLines({ trim: false, removeEmptyEntries: true });

                // Generate all of the promises at once
                const promises = lines.map(l => this.readSpec(l));

                // Then let them run concurrently (they are file io)
                const specs = await Promise.all(promises);
                return specs.filter(s => s);
            }
        }

        return [];
    }

    private findInterpreterCommand = async (command: string, interpreter: PythonInterpreter, cancelToken?: CancellationToken) : Promise<JupyterCommand | undefined> => {
        // If the module is found on this interpreter, then we found it.
        if (interpreter && await this.doesModuleExist(command, interpreter, cancelToken) && !Cancellation.isCanceled(cancelToken)) {
            // We need a process service to create a command
            const processService = await this.processServicePromise;

            // Our command args are different based on the command. ipykernel is not a jupyter command
            const args = command === KernelCreateCommand ? ['-m', command] : ['-m', 'jupyter', command];

            return new JupyterCommand(interpreter.path, args, processService, this.interpreterService, this.condaService);
        }

        return undefined;
    }

    private lookForJupyterInDirectory = async (pathToCheck: string): Promise<string[]> => {
        try {
            const files = await this.fileSystem.getFiles(pathToCheck);
            return files ? files.filter(s => CheckJupyterRegEx.test(path.basename(s))) : [];
        } catch (err) {
            this.logger.logWarning('Python Extension (fileSystem.getFiles):', err);
        }
        return [] as string[];
    }

    private searchPathsForJupyter = async () : Promise<string | undefined> => {
        if (!this.jupyterPath) {
            const paths = this.knownSearchPaths.getSearchPaths();
            for (let i = 0; i < paths.length && !this.jupyterPath; i += 1) {
                const found = await this.lookForJupyterInDirectory(paths[i]);
                if (found.length > 0) {
                    this.jupyterPath = found[0];
                }
            }
        }
        return this.jupyterPath;
    }

    private findPathCommand = async (command: string, cancelToken?: CancellationToken) : Promise<JupyterCommand | undefined> => {
        if (await this.doesJupyterCommandExist(command, cancelToken) && !Cancellation.isCanceled(cancelToken)) {
            // Search the known paths for jupyter
            const jupyterPath = await this.searchPathsForJupyter();
            if (jupyterPath) {
                // We need a process service to create a command
                const processService = await this.processServicePromise;
                return new JupyterCommand(jupyterPath, [command], processService, this.interpreterService, this.condaService);
            }
        }
        return undefined;
    }

    // For jupyter,
    // - Look in current interpreter, if found create something that has path and args
    // - Look in other interpreters, if found create something that has path and args
    // - Look on path, if found create something that has path and args
    // For general case
    // - Look for module in current interpreter, if found create something with python path and -m module
    // - Look in other interpreters, if found create something with python path and -m module
    // - Look on path for jupyter, if found create something with jupyter path and args
    private findBestCommand = async (command: string, cancelToken?: CancellationToken) : Promise<JupyterCommand | undefined> => {
        // See if we already have this command in list
        if (!this.commands.hasOwnProperty(command)) {
            // Not found, try to find it.

            // First we look in the current interpreter
            const current = await this.interpreterService.getActiveInterpreter();
            let found = current ? await this.findInterpreterCommand(command, current, cancelToken) : undefined;
            if (!found) {
                // Look through all of our interpreters (minus the active one at the same time)
                const all = await this.interpreterService.getInterpreters();
                const promises = all.filter(i => i !== current).map(i => this.findInterpreterCommand(command, i, cancelToken));
                const foundList = await Promise.all(promises);
                found = foundList.find(f => f !== undefined);
            }

            // If still not found, try looking on the path using jupyter
            if (!found) {
                found = await this.findPathCommand(command, cancelToken);
            }

            // If we found a command, save in our dictionary
            if (found) {
                this.commands[command] = found;
            }
        }

        // Return result
        return this.commands.hasOwnProperty(command) ? this.commands[command] : undefined;
    }

    private doesModuleExist = async (module: string, interpreter: PythonInterpreter, cancelToken?: CancellationToken): Promise<boolean> => {
        if (interpreter && interpreter !== null) {
            const newOptions: SpawnOptions = { throwOnStdErr: true, encoding: 'utf8', token: cancelToken };
            newOptions.env = await this.fixupCondaEnv(newOptions.env, interpreter);
            const pythonService = await this.executionFactory.create({ pythonPath: interpreter.path });
            try {
                // Special case for ipykernel
                const actualModule = module === KernelCreateCommand ? module : 'jupyter';
                const args = module === KernelCreateCommand ? ['--version'] : [module, '--version'];

                const result = await pythonService.execModule(actualModule, args, newOptions);
                return !result.stderr;
            } catch (err) {
                this.logger.logWarning(err);
                return false;
            }
        } else {
            return false;
        }
    }

    private doesJupyterCommandExist = async (command?: string, cancelToken?: CancellationToken) : Promise<boolean> => {
        const newOptions : SpawnOptions = {throwOnStdErr: true, encoding: 'utf8', token: cancelToken};
        const args = command ? [command, '--version'] : ['--version'];
        const processService = await this.processServicePromise;
        try {
            const result = await processService.exec('jupyter', args, newOptions);
            return !result.stderr;
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

}
