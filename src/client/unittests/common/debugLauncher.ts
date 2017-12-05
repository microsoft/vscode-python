import * as getFreePort from 'get-port';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import 'reflect-metadata';
import { debug, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { IPythonExecutionFactory } from '../../common/process/types';
import { createDeferred } from './../../common/helpers';
import { ITestDebugLauncher, launchOptions } from './types';

const HAND_SHAKE = `READY${os.EOL}`;

@injectable()
export class DebugLauncher implements ITestDebugLauncher {
    constructor( @inject(IPythonExecutionFactory) private pythonExecutionFactory: IPythonExecutionFactory) { }
    public getPort(resource?: Uri): Promise<number> {
        const pythonSettings = PythonSettings.getInstance(resource);
        const port = pythonSettings.unitTest.debugPort;
        return new Promise<number>((resolve, reject) => getFreePort({ host: 'localhost', port }).then(resolve, reject));
    }
    public async launchDebugger(options: launchOptions) {
        const cwdUri = options.cwd ? Uri.file(options.cwd) : undefined;
        return this.pythonExecutionFactory.create(cwdUri)
            .then(executionService => {
                // tslint:disable-next-line:no-any
                const def = createDeferred<void>();
                // tslint:disable-next-line:no-any
                const launchDef = createDeferred<void>();

                let outputChannelShown = false;
                let accumulatedData: string = '';
                const result = executionService.execObservable(options.args, { cwd: options.cwd, mergeStdOutErr: true, token: options.token });
                result.out.subscribe(output => {
                    let data = output.out;
                    if (!launchDef.resolved) {
                        accumulatedData += output.out;
                        if (!accumulatedData.startsWith(HAND_SHAKE)) {
                            return;
                        }
                        // Socket server has started, lets start the vs debugger.
                        launchDef.resolve();
                        data = accumulatedData.substring(HAND_SHAKE.length);
                    }

                    if (!outputChannelShown) {
                        outputChannelShown = true;
                        options.outChannel!.show();
                    }
                    options.outChannel!.append(data);
                }, error => {
                    if (!def.completed) {
                        def.reject(error);
                    }
                }, () => {
                    // Complete only when the process has completed.
                    if (!def.completed) {
                        def.resolve();
                    }
                });

                launchDef.promise
                    .then(() => {
                        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
                            throw new Error('Please open a workspace');
                        }
                        let workspaceFolder = workspace.getWorkspaceFolder(cwdUri!);
                        if (!workspaceFolder) {
                            workspaceFolder = workspace.workspaceFolders[0];
                        }
                        return debug.startDebugging(workspaceFolder, {
                            name: 'Debug Unit Test',
                            type: 'python',
                            request: 'attach',
                            localRoot: options.cwd,
                            remoteRoot: options.cwd,
                            port: options.port,
                            secret: 'my_secret',
                            host: 'localhost'
                        });
                    })
                    .catch(reason => {
                        if (!def.completed) {
                            def.reject(reason);
                        }
                    });

                return def.promise;
            });
    }
}
