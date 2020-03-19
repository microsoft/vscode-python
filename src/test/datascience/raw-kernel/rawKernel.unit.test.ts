// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { noop } from '../../../client/common/utils/misc';
import { RawKernel } from '../../../client/datascience/raw-kernel/rawKernel';
import { IJMPConnection } from '../../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('Data Science - RawKernel', () => {
    let rawKernel: RawKernel;
    let jmpConnection: IJMPConnection;

    setup(() => {
        //jmpConnection = mock<IJMPConnection>();
    });

    //test('Start a session when connecting', async () => {
    //await connect();
    //assert.isTrue(jupyterSession.isConnected);
    //verify(sessionManager.startNew(anything())).once();
    //verify(contentsManager.newUntitled(anything())).once();
    //});
});
