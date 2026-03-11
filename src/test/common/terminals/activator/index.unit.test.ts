// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Terminal, Uri } from 'vscode';
import { TerminalActivator } from '../../../../client/common/terminal/activator';
import {
    ITerminalActivationHandler,
    ITerminalActivator,
    ITerminalHelper,
} from '../../../../client/common/terminal/types';
import {
    IConfigurationService,
    IExperimentService,
    IPythonSettings,
    ITerminalSettings,
} from '../../../../client/common/types';
import * as extapi from '../../../../client/envExt/api.internal';
import * as workspaceApis from '../../../../client/common/vscodeApis/workspaceApis';
import * as extensionsApi from '../../../../client/common/vscodeApis/extensionsApi';

suite('Terminal Activator', () => {
    let activator: TerminalActivator;
    let baseActivator: TypeMoq.IMock<ITerminalActivator>;
    let handler1: TypeMoq.IMock<ITerminalActivationHandler>;
    let handler2: TypeMoq.IMock<ITerminalActivationHandler>;
    let terminalSettings: TypeMoq.IMock<ITerminalSettings>;
    let experimentService: TypeMoq.IMock<IExperimentService>;
    let useEnvExtensionStub: sinon.SinonStub;
    let shouldEnvExtHandleActivationStub: sinon.SinonStub;
    setup(() => {
        useEnvExtensionStub = sinon.stub(extapi, 'useEnvExtension');
        useEnvExtensionStub.returns(false);
        shouldEnvExtHandleActivationStub = sinon.stub(extapi, 'shouldEnvExtHandleActivation');
        shouldEnvExtHandleActivationStub.returns(false);

        baseActivator = TypeMoq.Mock.ofType<ITerminalActivator>();
        terminalSettings = TypeMoq.Mock.ofType<ITerminalSettings>();
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        experimentService.setup((e) => e.inExperimentSync(TypeMoq.It.isAny())).returns(() => false);
        handler1 = TypeMoq.Mock.ofType<ITerminalActivationHandler>();
        handler2 = TypeMoq.Mock.ofType<ITerminalActivationHandler>();
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService
            .setup((c) => c.getSettings(TypeMoq.It.isAny()))
            .returns(() => {
                return ({
                    terminal: terminalSettings.object,
                } as unknown) as IPythonSettings;
            });
        activator = new (class extends TerminalActivator {
            protected initialize() {
                this.baseActivator = baseActivator.object;
            }
        })(
            TypeMoq.Mock.ofType<ITerminalHelper>().object,
            [handler1.object, handler2.object],
            configService.object,
            experimentService.object,
        );
    });
    teardown(() => {
        sinon.restore();
    });

    async function testActivationAndHandlers(
        activationSuccessful: boolean,
        activateEnvironmentSetting: boolean,
        hidden: boolean = false,
    ) {
        terminalSettings
            .setup((b) => b.activateEnvironment)
            .returns(() => activateEnvironmentSetting)
            .verifiable(TypeMoq.Times.once());
        baseActivator
            .setup((b) => b.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(activationSuccessful))
            .verifiable(TypeMoq.Times.exactly(activationSuccessful ? 1 : 0));
        handler1
            .setup((h) =>
                h.handleActivation(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isValue(activationSuccessful),
                ),
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.exactly(activationSuccessful ? 1 : 0));
        handler2
            .setup((h) =>
                h.handleActivation(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isValue(activationSuccessful),
                ),
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.exactly(activationSuccessful ? 1 : 0));

        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const activated = await activator.activateEnvironmentInTerminal(terminal.object, {
            preserveFocus: activationSuccessful,
            hideFromUser: hidden,
        });

        assert.strictEqual(activated, activationSuccessful);
        baseActivator.verifyAll();
        handler1.verifyAll();
        handler2.verifyAll();
    }
    test('Terminal is activated and handlers are invoked', () => testActivationAndHandlers(true, true));
    test('Terminal is not activated if auto-activate setting is set to true but terminal is hidden', () =>
        testActivationAndHandlers(false, true, true));
    test('Terminal is not activated and handlers are invoked', () => testActivationAndHandlers(false, false));

    test('Terminal is not activated from Python extension when Env extension should handle activation', async () => {
        shouldEnvExtHandleActivationStub.returns(true);
        terminalSettings.setup((b) => b.activateEnvironment).returns(() => true);
        baseActivator
            .setup((b) => b.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.never());

        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const activated = await activator.activateEnvironmentInTerminal(terminal.object, {
            preserveFocus: true,
        });

        assert.strictEqual(activated, false);
        baseActivator.verifyAll();
    });
});

suite('shouldEnvExtHandleActivation', () => {
    let getExtensionStub: sinon.SinonStub;
    let getConfigurationStub: sinon.SinonStub;
    let getWorkspaceFoldersStub: sinon.SinonStub;

    setup(() => {
        getExtensionStub = sinon.stub(extensionsApi, 'getExtension');
        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        getWorkspaceFoldersStub = sinon.stub(workspaceApis, 'getWorkspaceFolders');
        getWorkspaceFoldersStub.returns(undefined);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Returns false when envs extension is not installed', () => {
        getExtensionStub.returns(undefined);
        assert.strictEqual(extapi.shouldEnvExtHandleActivation(), false);
    });

    test('Returns true when envs extension is installed and setting is not explicitly set', () => {
        getExtensionStub.returns({ id: extapi.ENVS_EXTENSION_ID });
        getConfigurationStub.returns({
            inspect: () => ({ globalValue: undefined, workspaceValue: undefined }),
        });
        assert.strictEqual(extapi.shouldEnvExtHandleActivation(), true);
    });

    test('Returns false when envs extension is installed but globalValue is false', () => {
        getExtensionStub.returns({ id: extapi.ENVS_EXTENSION_ID });
        getConfigurationStub.returns({
            inspect: () => ({ globalValue: false, workspaceValue: undefined }),
        });
        assert.strictEqual(extapi.shouldEnvExtHandleActivation(), false);
    });

    test('Returns false when envs extension is installed but workspaceValue is false', () => {
        getExtensionStub.returns({ id: extapi.ENVS_EXTENSION_ID });
        getConfigurationStub.returns({
            inspect: () => ({ globalValue: undefined, workspaceValue: false }),
        });
        assert.strictEqual(extapi.shouldEnvExtHandleActivation(), false);
    });

    test('Returns true when envs extension is installed and setting is explicitly true', () => {
        getExtensionStub.returns({ id: extapi.ENVS_EXTENSION_ID });
        getConfigurationStub.returns({
            inspect: () => ({ globalValue: true, workspaceValue: undefined }),
        });
        assert.strictEqual(extapi.shouldEnvExtHandleActivation(), true);
    });

    test('Returns false when a workspace folder has workspaceFolderValue set to false', () => {
        getExtensionStub.returns({ id: extapi.ENVS_EXTENSION_ID });
        const folderUri = Uri.parse('file:///workspace/folder1');
        getWorkspaceFoldersStub.returns([{ uri: folderUri, name: 'folder1', index: 0 }]);
        getConfigurationStub.callsFake((_section: string, scope?: Uri) => {
            if (scope) {
                return {
                    inspect: () => ({ workspaceFolderValue: false }),
                };
            }
            return {
                inspect: () => ({ globalValue: undefined, workspaceValue: undefined }),
            };
        });
        assert.strictEqual(extapi.shouldEnvExtHandleActivation(), false);
    });
});
