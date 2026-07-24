// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as apiInternal from '../../client/envExt/api.internal';
import * as environmentApi from '../../client/environmentApi';
import * as workspaceApis from '../../client/common/vscodeApis/workspaceApis';
import { getActiveInterpreterLegacy } from '../../client/envExt/api.legacy';
import { PythonEnvironment } from '../../client/envExt/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function buildEnv(executable: string, version: string): PythonEnvironment {
    return {
        envId: { id: executable, managerId: 'ms-python.python:system' },
        name: 'env',
        displayName: 'env',
        displayPath: executable,
        version,
        environmentPath: Uri.file(executable),
        execInfo: { run: { executable } },
        sysPrefix: '/usr',
    } as any;
}

suite('Env extension legacy API - getActiveInterpreterLegacy', () => {
    let getEnvExtApiStub: sinon.SinonStub;
    let getEnvironmentStub: sinon.SinonStub;

    setup(() => {
        getEnvExtApiStub = sinon.stub(apiInternal, 'getEnvExtApi');
        getEnvExtApiStub.resolves({ getPythonProject: () => undefined } as any);
        getEnvironmentStub = sinon.stub(apiInternal, 'getEnvironment');
        sinon.stub(environmentApi, 'reportActiveInterpreterChanged');
        sinon.stub(workspaceApis, 'getWorkspaceFolders').returns([] as any);
        sinon.stub(workspaceApis, 'getWorkspaceFolder').returns(undefined);
    });

    teardown(() => {
        sinon.restore();
    });

    test('De-duplicates concurrent calls for the same resource', async () => {
        let resolveEnv: (value: PythonEnvironment) => void = () => undefined;
        const envPromise = new Promise<PythonEnvironment>((resolve) => {
            resolveEnv = resolve;
        });
        getEnvironmentStub.returns(envPromise);

        const promise1 = getActiveInterpreterLegacy(undefined);
        const promise2 = getActiveInterpreterLegacy(undefined);

        // Unblock the shared resolution and let both callers settle.
        resolveEnv(buildEnv('/usr/bin/python', '3.10.0'));
        const [result1, result2] = await Promise.all([promise1, promise2]);

        expect(result1?.path).to.equal('/usr/bin/python');
        expect(result2?.path).to.equal('/usr/bin/python');
        // Both concurrent callers shared a single underlying resolution.
        expect(getEnvironmentStub.callCount).to.equal(1);
    });

    test('Issues a fresh resolution once the previous one has completed', async () => {
        getEnvironmentStub.resolves(buildEnv('/usr/bin/python', '3.10.0'));

        await getActiveInterpreterLegacy(undefined);
        await getActiveInterpreterLegacy(undefined);

        expect(getEnvironmentStub.callCount).to.equal(2);
    });
});
