// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { exec } from 'child_process';
import { noop } from 'jquery';
import uuid from 'uuid';
import { QuickPickItem } from 'vscode';
import { createDeferred } from './async';
import {
    IJupyterServerUri,
    IJupyterUriQuickPicker,
    IMultiStepInput,
    InputStep,
    JupyterServerUriHandle
} from './typings/python';

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
            items: [{ label: 'rchiodocom2' }, { label: 'rchiodonotexist' }]
        });
        if (result && result.label === 'rchiodocom2') {
            try {
                completion('rchiodocom2');
            } catch {
                noop();
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
                        baseUrl: 'https://rchiodocom2.westus.instances.azureml.net',
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
