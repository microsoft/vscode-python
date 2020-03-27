import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { DebugSession, OutputEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { open } from '../../../common/open';
import { noop } from '../../../common/utils/misc';
import { IServiceContainer } from '../../../ioc/types';
import { LaunchRequestArguments } from '../../types';
import { IDebugServer } from '../Common/Contracts';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { LocalDebugServerV2 } from '../DebugServers/LocalDebugServerV2';
import { ILocalDebugLauncherScriptProvider } from '../types';
import { DebugClient, DebugType } from './DebugClient';

enum DebugServerStatus {
    Unknown = 1,
    Running = 2,
    NotRunning = 3,
}

export class LocalDebugClient extends DebugClient<LaunchRequestArguments> {
    protected pyProc: ChildProcess | undefined;
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
    constructor(
        args: LaunchRequestArguments,
        debugSession: DebugSession,
        private canLaunchTerminal: boolean,
        protected launcherScriptProvider: ILocalDebugLauncherScriptProvider
    ) {
        super(args, debugSession);
    }

    public CreateDebugServer(serviceContainer?: IServiceContainer): BaseDebugServer {
        this.debugServer = new LocalDebugServerV2(this.debugSession, this.args, serviceContainer!);
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
            this.pyProc.kill();
            this.pyProc = undefined;
        }
    }
    // tslint:disable-next-line:no-any
    private displayError(error: any) {
        const errorMsg =
            typeof error === 'string' ? error : error.message && error.message.length > 0 ? error.message : '';
        if (errorMsg.length > 0) {
            this.debugSession.sendEvent(new OutputEvent(errorMsg, 'stderr'));
        }
    }
    // tslint:disable-next-line:max-func-body-length member-ordering no-any
    public async LaunchApplicationToDebug(dbgServer: IDebugServer): Promise<any> {
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
            const args = this.buildLaunchArguments(processCwd, dbgServer.port);
            const envVars = this.args.env ? { ...this.args.env } : {};
            switch (this.args.console) {
                case 'externalTerminal':
                case 'integratedTerminal': {
                    const isSudo =
                        Array.isArray(this.args.debugOptions) && this.args.debugOptions.some((opt) => opt === 'Sudo');
                    this.launchExternalTerminal(isSudo, processCwd, pythonPath, args, envVars)
                        .then(resolve)
                        .catch(reject);
                    break;
                }
                default: {
                    this.pyProc = spawn(pythonPath, args, { cwd: processCwd, env: envVars });
                    this.handleProcessOutput(this.pyProc!, reject);

                    // Here we wait for the application to connect to the socket server.
                    // Only once connected do we know that the application has successfully launched.
                    this.debugServer!.DebugClientConnected.then(resolve)
                        // tslint:disable-next-line: no-console
                        .catch((ex) => console.error('Python Extension: debugServer.DebugClientConnected', ex));
                }
            }
        });
    }
    // tslint:disable-next-line:member-ordering
    protected handleProcessOutput(proc: ChildProcess, failedToLaunch: (error: Error | string | Buffer) => void) {
        proc.on('error', (error) => {
            // If debug server has started, then don't display errors.
            // The debug adapter will get this info from the debugger (e.g. ptvsd lib).
            const status = this.debugServerStatus;
            if (status === DebugServerStatus.Running) {
                return;
            }
            if (status === DebugServerStatus.NotRunning && typeof error === 'object' && error !== null) {
                return failedToLaunch(error);
            }
            // This could happen when the debugger didn't launch at all, e.g. python doesn't exist.
            this.displayError(error);
        });
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', noop);
        proc.stdout.on('data', (_) => {
            // This is necessary so we read the stdout of the python process,
            // Else it just keep building up (related to issue #203 and #52).
            // tslint:disable-next-line:prefer-const no-unused-variable
            noop();
        });
    }
    private buildLaunchArguments(cwd: string, debugPort: number): string[] {
        return [...this.buildDebugArguments(cwd, debugPort), ...this.buildStandardArguments()];
    }

    // tslint:disable-next-line:member-ordering
    protected buildDebugArguments(_cwd: string, _debugPort: number): string[] {
        throw new Error('Not Implemented');
    }
    // tslint:disable-next-line:member-ordering
    protected buildStandardArguments() {
        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return ['-m', this.args.module, ...programArgs];
        }
        if (this.args.program && this.args.program.length > 0) {
            return [this.args.program, ...programArgs];
        }
        return programArgs;
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
                    env,
                };
                this.debugSession.runInTerminalRequest(termArgs, 5000, (response) => {
                    if (response.success) {
                        resolve();
                    } else {
                        reject(response);
                    }
                });
            } else {
                open({ wait: false, app: [pythonPath].concat(args), cwd, env, sudo: sudo }).then(
                    (proc) => {
                        this.pyProc = proc;
                        resolve();
                    },
                    (error) => {
                        if (this.debugServerStatus === DebugServerStatus.Running) {
                            return;
                        }
                        reject(error);
                    }
                );
            }
        });
    }
}
