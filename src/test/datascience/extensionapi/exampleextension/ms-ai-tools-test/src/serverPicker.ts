// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { exec } from 'child_process';
import * as uuid from 'uuid/v4';
import { QuickPickItem } from 'vscode';
import { createDeferred } from './async';
import {
    IJupyterServerUri,
    IJupyterUriQuickPicker,
    IMultiStepInput,
    InputStep,
    JupyterServerUriHandle
} from './typings/python';

// This is an example of how to implement the IJupyterUriQuickPicker. Replace
// the machine name and server URI below with your own version
const Compute_Name = 'rchiodocom';
const Compute_Name_NotWorking = 'rchiodonw';
const Compute_ServerUri = 'https://rchiodocom2.westus.instances.azureml.net';

export class RemoteServerPickerExample implements IJupyterUriQuickPicker {
    public id = uuid();
    public getQuickPickEntryItems(): QuickPickItem[] {
        return [
            {
                label: '$(clone) Azure COMPUTE',
                detail: 'Use Azure COMPUTE to run your notebooks'
            }
        ];
    }
    public async handleNextSteps(
        _item: QuickPickItem,
        completion: (uriHandle: JupyterServerUriHandle | undefined) => void,
        input: IMultiStepInput<{}>,
        _state: {}
    ): Promise<InputStep<{}> | void> {
        // Show a quick pick list to start off.
        const result = await input.showQuickPick({
            title: 'Pick a compute instance',
            placeholder: 'Choose instance',
            items: [{ label: Compute_Name }, { label: Compute_Name_NotWorking }]
        });
        if (result && result.label === Compute_Name) {
            try {
                completion(Compute_Name);
            } catch {
                // Do nothing if it fails.
            }
        }
        completion(undefined);
    }

    public getServerUri(_handle: JupyterServerUriHandle): Promise<IJupyterServerUri> {
        const headerResults = createDeferred<IJupyterServerUri>();
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
                    headerResults.resolve({
                        baseUrl: Compute_ServerUri,
                        token: '', //output.accessToken,
                        authorizationHeader: { Authorization: `Bearer ${output.accessToken}` }
                    });
                } else {
                    headerResults.reject('Unable to get az token');
                }
            }
        );
        return headerResults.promise;
    }
}
