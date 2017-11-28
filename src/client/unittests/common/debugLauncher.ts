import * as getFreePort from 'get-port';
import * as os from 'os';
import { debug, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { createDeferred } from './../../common/helpers';
import { execPythonFile } from './../../common/utils';
import { ITestDebugLauncher, launchOptions } from './types';

const HAND_SHAKE = `READY${os.EOL}`;

export class DebugLauncher implements ITestDebugLauncher {
    public getPort(resource?: Uri): Promise<number> {
        const pythonSettings = PythonSettings.getInstance(resource);
        const port = pythonSettings.unitTest.debugPort;
        return new Promise<number>((resolve, reject) => getFreePort({ host: 'localhost', port }).then(resolve, reject));
    }
    public async launchDebugger(options: launchOptions) {
        const pythonSettings = PythonSettings.getInstance(options.cwd ? Uri.file(options.cwd) : undefined);
        // tslint:disable-next-line:no-any
        const def = createDeferred<void>();
        // tslint:disable-next-line:no-any
        const launchDef = createDeferred<void>();

        let outputChannelShown = false;
        let accumulatedData: string = '';
        execPythonFile(options.cwd, pythonSettings.pythonPath, options.args, options.cwd, true, (data: string) => {
            if (!launchDef.resolved) {
                accumulatedData += data;
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
        }, options.token)
            .then(() => {
                // Complete only when the process has completed.
                if (!def.completed) {
                    def.resolve();
                }
            })
            .catch(reason => {
                if (!def.completed) {
                    def.reject(reason);
                }
            });

        launchDef.promise
            .then(() => {
                if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
                    throw new Error('Please open a workspace');
                }
                let workspaceFolder = workspace.getWorkspaceFolder(Uri.file(options.cwd));
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
    }
}
