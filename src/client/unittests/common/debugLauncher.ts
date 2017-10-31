import * as os from 'os';
import { CancellationToken, debug, OutputChannel, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { createDeferred } from './../../common/helpers';
import { execPythonFile } from './../../common/utils';
import { ITestDebugLauncher } from './types';

export class DebugLauncher implements ITestDebugLauncher {
    public async launchDebugger(rootDirectory: string, testArgs: string[], token?: CancellationToken, outChannel?: OutputChannel) {
        const pythonSettings = PythonSettings.getInstance(rootDirectory ? Uri.file(rootDirectory) : undefined);
        // tslint:disable-next-line:no-any
        const def = createDeferred<any>();
        // tslint:disable-next-line:no-any
        const launchDef = createDeferred<any>();
        let outputChannelShown = false;
        execPythonFile(rootDirectory, pythonSettings.pythonPath, testArgs, rootDirectory, true, (data: string) => {
            if (data.startsWith(`READY${os.EOL}`)) {
                // debug socket server has started.
                launchDef.resolve();
                data = data.substring((`READY${os.EOL}`).length);
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
                port: pythonSettings.unitTest.debugPort,
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
