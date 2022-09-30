// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { CreateEnvironmentProvider } from '../../../../client/pythonEnvironments/creation/types';
import { VenvCreationProvider } from '../../../../client/pythonEnvironments/creation/provider/venvCreationProvider';
import { IInterpreterQuickPick } from '../../../../client/interpreter/configuration/types';
import * as wsSelect from '../../../../client/pythonEnvironments/creation/common/workspaceSelection';
import * as rawProcessApis from '../../../../client/common/process/rawProcessApis';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { createDeferred } from '../../../../client/common/utils/async';
import { Output } from '../../../../client/common/process/types';
import { VENV_CREATED_MARKER } from '../../../../client/pythonEnvironments/creation/provider/venvProgressAndTelemetry';

chaiUse(chaiAsPromised);

suite('venv Creation provider tests', () => {
    let venvProvider: CreateEnvironmentProvider;
    let pickWorkspaceFolderStub: sinon.SinonStub;
    let interpreterQuickPick: typemoq.IMock<IInterpreterQuickPick>;
    let execObservableStub: sinon.SinonStub;

    setup(() => {
        pickWorkspaceFolderStub = sinon.stub(wsSelect, 'pickWorkspaceFolder');
        execObservableStub = sinon.stub(rawProcessApis, 'execObservable');
        interpreterQuickPick = typemoq.Mock.ofType<IInterpreterQuickPick>();
        venvProvider = new VenvCreationProvider(interpreterQuickPick.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('No workspace selected', async () => {
        pickWorkspaceFolderStub.resolves(undefined);

        assert.isUndefined(await venvProvider.createEnvironment());
        assert.isTrue(pickWorkspaceFolderStub.calledOnce);
    });

    test('No Python selected', async () => {
        pickWorkspaceFolderStub.resolves({
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        });

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        assert.isUndefined(await venvProvider.createEnvironment());
        interpreterQuickPick.verifyAll();
    });

    test('Create venv with python selected by user', async () => {
        const workspace1 = {
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        };
        pickWorkspaceFolderStub.resolves(workspace1);

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve('/usr/bin/python'))
            .verifiable(typemoq.Times.once());

        const deferred = createDeferred();
        let _next: undefined | ((value: Output<string>) => void);
        let _complete: undefined | (() => void);
        execObservableStub.callsFake(() => {
            deferred.resolve();
            return {
                proc: undefined,
                out: {
                    subscribe: (
                        next?: (value: Output<string>) => void,
                        _error?: (error: unknown) => void,
                        complete?: () => void,
                    ) => {
                        _next = next;
                        _complete = complete;
                    },
                },
                dispose: () => undefined,
            };
        });

        const promise = venvProvider.createEnvironment();
        await deferred.promise;
        assert.isDefined(_next);
        assert.isDefined(_complete);

        _next!({ out: `${VENV_CREATED_MARKER}new_environment`, source: 'stdout' });
        _complete!();
        assert.strictEqual(await promise, { path: 'new_environment', uri: workspace1.uri });
        interpreterQuickPick.verifyAll();
    });

    test('Create venv failed', async () => {
        pickWorkspaceFolderStub.resolves({
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        });

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.never());

        const deferred = createDeferred();
        let _error: undefined | ((error: unknown) => void);
        let _complete: undefined | (() => void);
        execObservableStub.callsFake(() => {
            deferred.resolve();
            return {
                proc: undefined,
                out: {
                    subscribe: (
                        _next?: (value: Output<string>) => void,
                        error?: (error: unknown) => void,
                        complete?: () => void,
                    ) => {
                        _error = error;
                        _complete = complete;
                    },
                },
                dispose: () => undefined,
            };
        });

        const promise = venvProvider.createEnvironment();
        await deferred.promise;
        assert.isDefined(_error);
        _error!('bad arguments');
        _complete!();
        await assert.isRejected(promise);
    });
});
