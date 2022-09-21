// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { CreateEnvironmentProvider } from '../../../../client/pythonEnvironments/creation/types';
import {
    VenvCreationProvider,
    VENV_CREATED_MARKER,
} from '../../../../client/pythonEnvironments/creation/provider/venvCreationProvider';
import { IDiscoveryAPI } from '../../../../client/pythonEnvironments/base/locator';
import { IInterpreterQuickPick } from '../../../../client/interpreter/configuration/types';
import * as wsSelect from '../../../../client/pythonEnvironments/creation/common/workspaceSelection';
import * as rawProcessApis from '../../../../client/common/process/rawProcessApis';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { PythonEnvKind, PythonEnvSource } from '../../../../client/pythonEnvironments/base/info';
import { Architecture } from '../../../../client/common/utils/platform';
import { createDeferred } from '../../../../client/common/utils/async';
import { Output } from '../../../../client/common/process/types';

chaiUse(chaiAsPromised);

const python37 = {
    name: 'Python 3.7',
    kind: PythonEnvKind.System,
    location: '/usr/bin/python3.7',
    source: [PythonEnvSource.PathEnvVar],
    executable: {
        filename: '/usr/bin/python3.7',
        ctime: 0,
        mtime: 0,
        sysPrefix: '',
    },
    version: {
        major: 3,
        minor: 7,
        micro: 7,
    },
    arch: Architecture.x64,
    distro: {
        org: 'python',
    },
};
const python38 = {
    name: 'Python 3.8',
    kind: PythonEnvKind.System,
    location: '/usr/bin/python3.8',
    source: [PythonEnvSource.PathEnvVar],
    executable: {
        filename: '/usr/bin/python3.8',
        ctime: 0,
        mtime: 0,
        sysPrefix: '',
    },
    version: {
        major: 3,
        minor: 8,
        micro: 8,
    },
    arch: Architecture.x64,
    distro: {
        org: 'python',
    },
};

suite('venv Creation provider tests', () => {
    let venvProvider: CreateEnvironmentProvider;
    let pickWorkspaceFolderStub: sinon.SinonStub;
    let discoveryApi: typemoq.IMock<IDiscoveryAPI>;
    let interpreterQuickPick: typemoq.IMock<IInterpreterQuickPick>;
    let execObservableStub: sinon.SinonStub;

    setup(() => {
        pickWorkspaceFolderStub = sinon.stub(wsSelect, 'pickWorkspaceFolder');
        execObservableStub = sinon.stub(rawProcessApis, 'execObservable');
        discoveryApi = typemoq.Mock.ofType<IDiscoveryAPI>();
        interpreterQuickPick = typemoq.Mock.ofType<IInterpreterQuickPick>();
        venvProvider = new VenvCreationProvider(discoveryApi.object, interpreterQuickPick.object);
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

        // Return multiple envs here to force user selection.
        discoveryApi
            .setup((d) => d.getEnvs(typemoq.It.isAny()))
            .returns(() => [python37, python38])
            .verifiable(typemoq.Times.once());

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        assert.isUndefined(await venvProvider.createEnvironment());
        discoveryApi.verifyAll();
        interpreterQuickPick.verifyAll();
    });

    test('Create venv with single global python', async () => {
        pickWorkspaceFolderStub.resolves({
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        });

        // Return single env here to skip user selection.
        discoveryApi
            .setup((d) => d.getEnvs(typemoq.It.isAny()))
            .returns(() => [python38])
            .verifiable(typemoq.Times.once());

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.never());

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
        assert.strictEqual(await promise, 'new_environment');
        discoveryApi.verifyAll();
        interpreterQuickPick.verifyAll();
    });

    test('Create venv with multiple global python', async () => {
        pickWorkspaceFolderStub.resolves({
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        });

        // Return single env here to skip user selection.
        discoveryApi
            .setup((d) => d.getEnvs(typemoq.It.isAny()))
            .returns(() => [python37, python38])
            .verifiable(typemoq.Times.once());

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(python38.executable.filename))
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
        assert.strictEqual(await promise, 'new_environment');
        discoveryApi.verifyAll();
        interpreterQuickPick.verifyAll();
    });

    test('Create venv failed', async () => {
        pickWorkspaceFolderStub.resolves({
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        });

        // Return single env here to skip user selection.
        discoveryApi
            .setup((d) => d.getEnvs(typemoq.It.isAny()))
            .returns(() => [python38])
            .verifiable(typemoq.Times.once());

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
