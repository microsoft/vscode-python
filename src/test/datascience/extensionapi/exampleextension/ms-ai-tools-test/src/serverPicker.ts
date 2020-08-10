// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { exec } from 'child_process';
import * as vscode from 'vscode';
import { IJupyterServerUri, IJupyterUriProvider, JupyterServerUriHandle } from './typings/python';

// This is an example of how to implement the IJupyterUriQuickPicker. Replace
// the machine name and server URI below with your own version
const Compute_Name = 'rchiodocom';
const Compute_Name_NotWorking = 'rchiodonw';
const Compute_ServerUri = 'https://rchiodocom2.westus.instances.azureml.net';

export class RemoteServerPickerExample implements IJupyterUriProvider {
    public get id() {
        return 'RemoteServerPickerExample'; // This should be a unique constant
    }
    public getQuickPickEntryItems(): vscode.QuickPickItem[] {
        return [
            {
                label: '$(clone) Azure COMPUTE',
                detail: 'Use Azure COMPUTE to run your notebooks'
            }
        ];
    }
    public handleQuickPick(
        _item: vscode.QuickPickItem,
        back: boolean
    ): Promise<JupyterServerUriHandle | 'back' | undefined> {
        // Show a quick pick list to start off.
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'Pick a compute instance';
        quickPick.placeholder = 'Choose instance';
        quickPick.buttons = back ? [vscode.QuickInputButtons.Back] : [];
        quickPick.items = [{ label: Compute_Name }, { label: Compute_Name_NotWorking }];
        let resolved = false;
        const result = new Promise<JupyterServerUriHandle | 'back' | undefined>((resolve, _reject) => {
            quickPick.onDidTriggerButton((b) => {
                if (b === vscode.QuickInputButtons.Back) {
                    resolved = true;
                    resolve('back');
                    quickPick.hide();
                }
            });
            quickPick.onDidChangeSelection((s) => {
                resolved = true;
                if (s && s[0].label === Compute_Name) {
                    resolve(Compute_Name);
                } else {
                    resolve(undefined);
                }
                quickPick.hide();
            });
            quickPick.onDidHide(() => {
                if (!resolved) {
                    resolve(undefined);
                }
            });
        });
        quickPick.show();
        return result;
    }

    public getServerUri(_handle: JupyterServerUriHandle): Promise<IJupyterServerUri> {
        return new Promise((resolve, reject) => {
            exec(
                'az account get-access-token',
                {
                    windowsHide: true,
                    encoding: 'utf-8'
                },
                (_e, stdout, _stderr) => {
                    // Stdout (if it worked) should have something like so:
                    // accessToken: bearerToken value
                    // tokenType: Bearer
                    // some other stuff
                    if (stdout) {
                        const output = JSON.parse(stdout.toString());
                        const currentDate = new Date();
                        resolve({
                            baseUrl: Compute_ServerUri,
                            token: '', //output.accessToken,
                            authorizationHeader: { Authorization: `Bearer ${output.accessToken}` },
                            expiration: new Date(
                                currentDate.getFullYear(),
                                currentDate.getMonth(),
                                undefined,
                                currentDate.getHours(),
                                currentDate.getMinutes() + 1 // Expire after one minute
                            )
                        });
                    } else {
                        reject('Unable to get az token');
                    }
                }
            );
        });
    }
}
