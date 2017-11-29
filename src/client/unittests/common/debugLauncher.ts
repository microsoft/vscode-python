import * as getFreePort from 'get-port';
import * as os from 'os';
import { CancellationToken, debug, OutputChannel, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { createDeferred } from './../../common/helpers';
import { execPythonFile } from './../../common/utils';
import { ITestDebugLauncher } from './types';

const HAND_SHAKE = `READY${os.EOL}`;

export class DebugLauncher implements ITestDebugLauncher {
    public getPort(resource?: Uri): Promise<number> {
        const pythonSettings = PythonSettings.getInstance(resource);
        const port = pythonSettings.unitTest.debugPort;
        return new Promise<number>((resolve, reject) => getFreePort({ host: 'localhost', port }).then(resolve, reject));
    }
    public async launchDebugger(rootDirectory: string, testArgs: string[], port: number, token?: CancellationToken, outChannel?: OutputChannel) {
        const pythonSettings = PythonSettings.getInstance(rootDirectory ? Uri.file(rootDirectory) : undefined);
        // tslint:disable-next-line:no-any
        const def = createDeferred<any>();
        // tslint:disable-next-line:no-any
        const launchDef = createDeferred<any>();
        let outputChannelShown = false;
        let accumulatedData: string = '';
        execPythonFile(rootDirectory, pythonSettings.pythonPath, testArgs, rootDirectory, true, (data: string) => {
            if (!launchDef.resolved) {
                accumulatedData += data;
                if (!accumulatedData.startsWith(HAND_SHAKE)) {
                    return;
                }
                // Socket server has started, lets start the debugger.
                launchDef.resolve();
                data = accumulatedData.substring(HAND_SHAKE.length);
            }

            if (!outputChannelShown) {
                outputChannelShown = true;
                outChannel.show();
            }
            outChannel.append(data);
        }, token).catch(reason => {
            if (!def.rejected && !def.resolved) {
                def.reject(reason);
            }
        }).then(() => {
            if (!def.rejected && !def.resolved) {
                def.resolve();
            }
        }).catch(reason => {
            if (!def.rejected && !def.resolved) {
                def.reject(reason);
            }
        });

        launchDef.promise.then(() => {
            if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
                throw new Error('Please open a workspace');
            }
            let workspaceFolder = workspace.getWorkspaceFolder(Uri.file(rootDirectory));
            if (!workspaceFolder) {
                workspaceFolder = workspace.workspaceFolders[0];
            }
            return debug.startDebugging(workspaceFolder, {
                name: 'Debug Unit Test',
                type: 'python',
                request: 'attach',
                localRoot: rootDirectory,
                remoteRoot: rootDirectory,
                port,
                secret: 'my_secret',
                host: 'localhost'
            });
        }).catch(reason => {
            if (!def.rejected && !def.resolved) {
                def.reject(reason);
            }
        });

        return def.promise;
    }
}
