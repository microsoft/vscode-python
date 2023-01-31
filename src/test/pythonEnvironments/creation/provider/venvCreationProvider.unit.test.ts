// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import * as sinon from 'sinon';
import { CancellationToken, ProgressOptions, Uri } from 'vscode';
import {
    CreateEnvironmentProgress,
    CreateEnvironmentProvider,
    CreateEnvironmentResult,
} from '../../../../client/pythonEnvironments/creation/types';
import { VenvCreationProvider } from '../../../../client/pythonEnvironments/creation/provider/venvCreationProvider';
import { IInterpreterQuickPick } from '../../../../client/interpreter/configuration/types';
import * as wsSelect from '../../../../client/pythonEnvironments/creation/common/workspaceSelection';
import * as windowApis from '../../../../client/common/vscodeApis/windowApis';
import * as rawProcessApis from '../../../../client/common/process/rawProcessApis';
import * as commonUtils from '../../../../client/pythonEnvironments/creation/common/commonUtils';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { createDeferred } from '../../../../client/common/utils/async';
import { Output } from '../../../../client/common/process/types';
import { VENV_CREATED_MARKER } from '../../../../client/pythonEnvironments/creation/provider/venvProgressAndTelemetry';
import { CreateEnv } from '../../../../client/common/utils/localize';
import * as venvUtils from '../../../../client/pythonEnvironments/creation/provider/venvUtils';

chaiUse(chaiAsPromised);

suite('venv Creation provider tests', () => {
    let venvProvider: CreateEnvironmentProvider;
    let pickWorkspaceFolderStub: sinon.SinonStub;
    let interpreterQuickPick: typemoq.IMock<IInterpreterQuickPick>;
    let progressMock: typemoq.IMock<CreateEnvironmentProgress>;
    let execObservableStub: sinon.SinonStub;
    let withProgressStub: sinon.SinonStub;
    let showErrorMessageWithLogsStub: sinon.SinonStub;
    let pickPackagesToInstallStub: sinon.SinonStub;

    const workspace1 = {
        uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
        name: 'workspace1',
        index: 0,
    };

    setup(() => {
        pickWorkspaceFolderStub = sinon.stub(wsSelect, 'pickWorkspaceFolder');
        execObservableStub = sinon.stub(rawProcessApis, 'execObservable');
        interpreterQuickPick = typemoq.Mock.ofType<IInterpreterQuickPick>();
        withProgressStub = sinon.stub(windowApis, 'withProgress');
        pickPackagesToInstallStub = sinon.stub(venvUtils, 'pickPackagesToInstall');

        showErrorMessageWithLogsStub = sinon.stub(commonUtils, 'showErrorMessageWithLogs');
        showErrorMessageWithLogsStub.resolves();

        progressMock = typemoq.Mock.ofType<CreateEnvironmentProgress>();
        venvProvider = new VenvCreationProvider(interpreterQuickPick.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('No workspace selected', async () => {
        pickWorkspaceFolderStub.resolves(undefined);
        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());

        assert.isUndefined(await venvProvider.createEnvironment());
        assert.isTrue(pickWorkspaceFolderStub.calledOnce);
        interpreterQuickPick.verifyAll();
        assert.isTrue(pickPackagesToInstallStub.notCalled);
    });

    test('No Python selected', async () => {
        pickWorkspaceFolderStub.resolves(workspace1);

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        assert.isUndefined(await venvProvider.createEnvironment());

        assert.isTrue(pickWorkspaceFolderStub.calledOnce);
        interpreterQuickPick.verifyAll();
        assert.isTrue(pickPackagesToInstallStub.notCalled);
    });

    test('User pressed Esc while selecting dependencies', async () => {
        pickWorkspaceFolderStub.resolves(workspace1);

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve('/usr/bin/python'))
            .verifiable(typemoq.Times.once());

        pickPackagesToInstallStub.resolves(undefined);

        assert.isUndefined(await venvProvider.createEnvironment());
        assert.isTrue(pickPackagesToInstallStub.calledOnce);
    });

    test('Create venv with python selected by user', async () => {
        pickWorkspaceFolderStub.resolves(workspace1);

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve('/usr/bin/python'))
            .verifiable(typemoq.Times.once());

        pickPackagesToInstallStub.resolves({
            installType: 'none',
            installList: [],
        });

        const deferred = createDeferred();
        let _next: undefined | ((value: Output<string>) => void);
        let _complete: undefined | (() => void);
        execObservableStub.callsFake(() => {
            deferred.resolve();
            return {
                proc: {
                    exitCode: 0,
                },
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

        progressMock.setup((p) => p.report({ message: CreateEnv.statusStarting })).verifiable(typemoq.Times.once());

        withProgressStub.callsFake(
            (
                _options: ProgressOptions,
                task: (
                    progress: CreateEnvironmentProgress,
                    token?: CancellationToken,
                ) => Thenable<CreateEnvironmentResult>,
            ) => task(progressMock.object),
        );

        const promise = venvProvider.createEnvironment();
        await deferred.promise;
        assert.isDefined(_next);
        assert.isDefined(_complete);

        _next!({ out: `${VENV_CREATED_MARKER}new_environment`, source: 'stdout' });
        _complete!();

        const actual = await promise;
        assert.deepStrictEqual(actual, { path: 'new_environment', uri: workspace1.uri });
        interpreterQuickPick.verifyAll();
        progressMock.verifyAll();
        assert.isTrue(showErrorMessageWithLogsStub.notCalled);
    });

    test('Create venv failed', async () => {
        pickWorkspaceFolderStub.resolves(workspace1);

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve('/usr/bin/python'))
            .verifiable(typemoq.Times.once());

        pickPackagesToInstallStub.resolves({
            installType: 'none',
            installList: [],
        });

        const deferred = createDeferred();
        let _error: undefined | ((error: unknown) => void);
        let _complete: undefined | (() => void);
        execObservableStub.callsFake(() => {
            deferred.resolve();
            return {
                proc: {
                    exitCode: 0,
                },
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

        progressMock.setup((p) => p.report({ message: CreateEnv.statusStarting })).verifiable(typemoq.Times.once());

        withProgressStub.callsFake(
            (
                _options: ProgressOptions,
                task: (
                    progress: CreateEnvironmentProgress,
                    token?: CancellationToken,
                ) => Thenable<CreateEnvironmentResult>,
            ) => task(progressMock.object),
        );

        const promise = venvProvider.createEnvironment();
        await deferred.promise;
        assert.isDefined(_error);
        _error!('bad arguments');
        _complete!();
        await assert.isRejected(promise);
        assert.isTrue(showErrorMessageWithLogsStub.calledOnce);
    });

    test('Create venv failed (non-zero exit code)', async () => {
        pickWorkspaceFolderStub.resolves(workspace1);

        interpreterQuickPick
            .setup((i) => i.getInterpreterViaQuickPick(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve('/usr/bin/python'))
            .verifiable(typemoq.Times.once());

        pickPackagesToInstallStub.resolves({
            installType: 'none',
            installList: [],
        });

        const deferred = createDeferred();
        let _next: undefined | ((value: Output<string>) => void);
        let _complete: undefined | (() => void);
        execObservableStub.callsFake(() => {
            deferred.resolve();
            return {
                proc: {
                    exitCode: 1,
                },
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

        progressMock.setup((p) => p.report({ message: CreateEnv.statusStarting })).verifiable(typemoq.Times.once());

        withProgressStub.callsFake(
            (
                _options: ProgressOptions,
                task: (
                    progress: CreateEnvironmentProgress,
                    token?: CancellationToken,
                ) => Thenable<CreateEnvironmentResult>,
            ) => task(progressMock.object),
        );

        const promise = venvProvider.createEnvironment();
        await deferred.promise;
        assert.isDefined(_next);
        assert.isDefined(_complete);

        _next!({ out: `${VENV_CREATED_MARKER}new_environment`, source: 'stdout' });
        _complete!();
        await assert.isRejected(promise);
        interpreterQuickPick.verifyAll();
        progressMock.verifyAll();
        assert.isTrue(showErrorMessageWithLogsStub.calledOnce);
    });
});
