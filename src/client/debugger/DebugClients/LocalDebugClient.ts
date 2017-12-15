import * as child_process from 'child_process';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { open } from '../../common/open';
import { PathUtils } from '../../common/platform/pathUtils';
import { EnvironmentVariablesService } from '../../common/variables/environment';
import { EnvironmentVariables } from '../../common/variables/types';
import { IDebugServer, IPythonProcess } from '../Common/Contracts';
import { LaunchRequestArguments } from '../Common/Contracts';
import { IS_WINDOWS } from '../Common/Utils';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { LocalDebugServer } from '../DebugServers/LocalDebugServer';
import { DebugClient, DebugType } from './DebugClient';

const VALID_DEBUG_OPTIONS = [
    'RedirectOutput',
    'DebugStdLib',
    'BreakOnSystemExitZero',
    'DjangoDebugging'];

enum DebugServerStatus {
    Unknown = 1,
    Running = 2,
    NotRunning = 3
}

export class LocalDebugClient extends DebugClient {
    protected pyProc: child_process.ChildProcess | undefined;
    protected pythonProcess: IPythonProcess;
    protected debugServer: BaseDebugServer | undefined;
    private get debugServerStatus(): DebugServerStatus {
        if (this.debugServer && this.debugServer!.IsRunning) {
            return DebugServerStatus.Running;
        }
        if (this.debugServer && !this.debugServer!.IsRunning) {
            return DebugServerStatus.NotRunning;
        }
        return DebugServerStatus.Unknown;
    }
    // tslint:disable-next-line:no-any
    constructor(args: any, debugSession: DebugSession, private canLaunchTerminal: boolean) {
        super(args, debugSession);
    }

    public CreateDebugServer(pythonProcess: IPythonProcess): BaseDebugServer {
        this.pythonProcess = pythonProcess;
        this.debugServer = new LocalDebugServer(this.debugSession, this.pythonProcess, this.args);
        return this.debugServer;
    }

    public get DebugType(): DebugType {
        return DebugType.Local;
    }

    public Stop() {
        if (this.debugServer) {
            this.debugServer!.Stop();
            this.debugServer = undefined;
        }

        if (this.pyProc) {
            try {
                this.pyProc!.send('EXIT');
                // tslint:disable-next-line:no-empty
            } catch { }
            try {
                this.pyProc!.stdin.write('EXIT');
                // tslint:disable-next-line:no-empty
            } catch { }
            try {
                this.pyProc!.disconnect();
                // tslint:disable-next-line:no-empty
            } catch { }
            this.pyProc = undefined;
        }
    }
    protected getLauncherFilePath(): string {
        const currentFileName = module.filename;
        const ptVSToolsPath = path.join(path.dirname(currentFileName), '..', '..', '..', '..', 'pythonFiles', 'PythonTools');
        return path.join(ptVSToolsPath, 'visualstudio_py_launcher.py');
    }
    // tslint:disable-next-line:no-any
    private displayError(error: any) {
        const errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        if (errorMsg.length > 0) {
            this.debugSession.sendEvent(new OutputEvent(errorMsg, 'stderr'));
        }
    }
    // tslint:disable-next-line:max-func-body-length member-ordering no-any
    public async LaunchApplicationToDebug(dbgServer: IDebugServer, processErrored: (error: any) => void): Promise<any> {
        const environmentVariables = await this.getEnvironmentVariables();
        // tslint:disable-next-line:max-func-body-length cyclomatic-complexity no-any
        return new Promise<any>((resolve, reject) => {
            const fileDir = this.args && this.args.program ? path.dirname(this.args.program) : '';
            let processCwd = fileDir;
            if (typeof this.args.cwd === 'string' && this.args.cwd.length > 0 && this.args.cwd !== 'null') {
                processCwd = this.args.cwd;
            }
            let pythonPath = 'python';
            if (typeof this.args.pythonPath === 'string' && this.args.pythonPath.trim().length > 0) {
                pythonPath = this.args.pythonPath;
            }
            if (!environmentVariables.hasOwnProperty('PYTHONIOENCODING')) {
                environmentVariables.PYTHONIOENCODING = 'UTF-8';
            }
            if (!environmentVariables.hasOwnProperty('PYTHONUNBUFFERED')) {
                environmentVariables.PYTHONUNBUFFERED = '1';
            }
            const ptVSToolsFilePath = this.getLauncherFilePath();
            const launcherArgs = this.buildLauncherArguments();

            const args = [ptVSToolsFilePath, processCwd, dbgServer.port.toString(), '34806ad9-833a-4524-8cd6-18ca4aa74f14'].concat(launcherArgs);
            switch (this.args.console) {
                case 'externalTerminal':
                case 'integratedTerminal': {
                    const isSudo = Array.isArray(this.args.debugOptions) && this.args.debugOptions.some(opt => opt === 'Sudo');
                    this.launchExternalTerminal(isSudo, processCwd, pythonPath, args, environmentVariables).then(resolve).catch(reject);
                    break;
                }
                default: {
                    // As we're spawning the process, we need to ensure all env variables are passed.
                    // Including those from the current process (i.e. everything, not just custom vars).
                    const envParser = new EnvironmentVariablesService(new PathUtils(IS_WINDOWS));
                    envParser.mergeVariables(process.env as EnvironmentVariables, environmentVariables);
                    this.pyProc = child_process.spawn(pythonPath, args, { cwd: processCwd, env: environmentVariables });
                    this.handleProcessOutput(this.pyProc!, reject);

                    // Here we wait for the application to connect to the socket server.
                    // Only once connected do we know that the application has successfully launched.
                    this.debugServer!.DebugClientConnected
                        .then(resolve)
                        .catch(ex => console.error('Python Extension: debugServer.DebugClientConnected', ex));
                }
            }
        });
    }
    // tslint:disable-next-line:member-ordering
    protected handleProcessOutput(proc: ChildProcess, failedToLaunch: (error: Error | string | Buffer) => void) {
        proc.on('error', error => {
            // If debug server has started, then don't display errors.
            // The debug adapter will get this info from the debugger (e.g. ptvsd lib).
            const status = this.debugServerStatus;
            if (status === DebugServerStatus.Running) {
                return;
            }
            if (status === DebugServerStatus.NotRunning && typeof (error) === 'object' && error !== null) {
                return failedToLaunch(error);
            }
            // This could happen when the debugger didn't launch at all, e.g. python doesn't exist.
            this.displayError(error);
        });
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', error => {
            // We generally don't need to display the errors as stderr output is being captured by debugger
            // and it gets sent out to the debug client.

            // Either way, we need some code in here so we read the stdout of the python process,
            // Else it just keep building up (related to issue #203 and #52).
            if (this.debugServerStatus === DebugServerStatus.NotRunning) {
                return failedToLaunch(error);
            }
        });
        proc.stdout.on('data', d => {
            // This is necessary so we read the stdout of the python process,
            // Else it just keep building up (related to issue #203 and #52).
            // tslint:disable-next-line:prefer-const no-unused-variable
            let x = 0;
        });
    }
    // tslint:disable-next-line:member-ordering
    protected buildLauncherArguments(): string[] {
        let vsDebugOptions = ['RedirectOutput'];
        if (Array.isArray(this.args.debugOptions)) {
            vsDebugOptions = this.args.debugOptions.filter(opt => VALID_DEBUG_OPTIONS.indexOf(opt) >= 0);
        }
        // If internal or external console, then don't re-direct the output.
        if (this.args.console === 'integratedTerminal' || this.args.console === 'externalTerminal') {
            vsDebugOptions = vsDebugOptions.filter(opt => opt !== 'RedirectOutput');
        }

        // Include a dummy value, to ensure something gets sent.
        // Else, argument positions get messed up due to an empty string.
        vsDebugOptions = vsDebugOptions.length === 0 ? ['DUMMYVALUE'] : vsDebugOptions;

        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return [vsDebugOptions.join(','), '-m', this.args.module].concat(programArgs);
        }
        return [vsDebugOptions.join(','), this.args.program].concat(programArgs);
    }
    private launchExternalTerminal(sudo: boolean, cwd: string, pythonPath: string, args: string[], env: {}) {
        return new Promise((resolve, reject) => {
            if (this.canLaunchTerminal) {
                const command = sudo ? 'sudo' : pythonPath;
                const commandArgs = sudo ? [pythonPath].concat(args) : args;
                const isExternalTerminal = this.args.console === 'externalTerminal';
                const consoleKind = isExternalTerminal ? 'external' : 'integrated';
                const termArgs: DebugProtocol.RunInTerminalRequestArguments = {
                    kind: consoleKind,
                    title: 'Python Debug Console',
                    cwd,
                    args: [command].concat(commandArgs),
                    env
                };
                this.debugSession.runInTerminalRequest(termArgs, 5000, (response) => {
                    if (response.success) {
                        resolve();
                    } else {
                        reject(response);
                    }
                });
            } else {
                open({ wait: false, app: [pythonPath].concat(args), cwd, env, sudo: sudo }).then(proc => {
                    this.pyProc = proc;
                    resolve();
                }, error => {
                    if (this.debugServerStatus === DebugServerStatus.Running) {
                        return;
                    }
                    reject(error);
                });
            }
        });
    }
    private async getEnvironmentVariables(): Promise<EnvironmentVariables> {
        const args = this.args as LaunchRequestArguments;
        const envParser = new EnvironmentVariablesService(new PathUtils(IS_WINDOWS));
        const envFileVars = await envParser.parseFile(args.envFile);

        const hasEnvVars = args.env && Object.keys(args.env).length > 0;
        if (!envFileVars && !hasEnvVars) {
            return {};
        }
        if (envFileVars && !hasEnvVars) {
            return envFileVars!;
        }
        if (!envFileVars && hasEnvVars) {
            return args.env as EnvironmentVariables;
        }
        // Merge the two sets of environment variables.
        const env = { ...args.env } as EnvironmentVariables;
        envParser.mergeVariables(envFileVars!, env);
        return env;
    }
}
