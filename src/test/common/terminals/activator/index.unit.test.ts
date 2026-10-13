// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import rewiremock from 'rewiremock';
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
    let api: typeof extapi;
    let getExtensionStub: sinon.SinonStub;
    let getConfigurationStub: sinon.SinonStub;
    let getWorkspaceFoldersStub: sinon.SinonStub;

    type SettingValues = {
        defaultValue?: boolean;
        globalValue?: boolean;
        workspaceValue?: boolean;
        workspaceFolderValue?: boolean;
    };

    function configuration(values: SettingValues = {}) {
        return {
            get: sinon
                .stub()
                .withArgs('useEnvironmentsExtension')
                .returns(
                    values.workspaceFolderValue ?? values.workspaceValue ?? values.globalValue ?? values.defaultValue,
                ),
            inspect: sinon.stub().returns(values),
        };
    }

    function assertOwnership(expected: boolean) {
        assert.strictEqual(api.shouldEnvExtHandleActivation(), expected);
        assert.strictEqual(api.useEnvExtension(), expected);
    }

    setup(() => {
        getExtensionStub = sinon.stub(extensionsApi, 'getExtension');
        getExtensionStub.returns({ id: extapi.ENVS_EXTENSION_ID });
        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        getConfigurationStub.returns(configuration());
        getWorkspaceFoldersStub = sinon.stub(workspaceApis, 'getWorkspaceFolders').returns(undefined);
        // A fresh module represents a new window, including its cached ownership decision.
        api = rewiremock.proxy(() => require('../../../../client/envExt/api.internal'), {
            [require.resolve('../../../../client/common/vscodeApis/extensionsApi')]: extensionsApi,
            [require.resolve('../../../../client/common/vscodeApis/workspaceApis')]: workspaceApis,
        });
    });

    teardown(() => {
        sinon.restore();
    });

    test('Returns false when envs extension is not installed', () => {
        getExtensionStub.returns(undefined);
        assertOwnership(false);
    });

    test('Registers an enabled fallback that experiments can override', () => {
        const manifest = require('../../../../../package.json');
        const setting = manifest.contributes.configuration.properties['python.useEnvironmentsExtension'];
        assert.strictEqual(setting.default, true);
        assert.include(setting.tags, 'onExP');
    });

    [undefined, true, false].forEach((defaultValue) => {
        [undefined, true, false].forEach((globalValue) => {
            [undefined, true, false].forEach((workspaceValue) => {
                test(`Uses effective value: default=${defaultValue}, user=${globalValue}, workspace=${workspaceValue}`, () => {
                    const config = configuration({ defaultValue, globalValue, workspaceValue });
                    getConfigurationStub.returns(config);

                    assertOwnership(workspaceValue ?? globalValue ?? defaultValue ?? true);
                    sinon.assert.calledWithExactly(config.get, 'useEnvironmentsExtension');
                    sinon.assert.notCalled(config.inspect);
                });
            });
        });
    });

    [undefined, []].forEach((folders) => {
        test(`Uses window configuration when workspace folders are ${JSON.stringify(folders)}`, () => {
            getWorkspaceFoldersStub.returns(folders);
            getConfigurationStub.returns(configuration({ defaultValue: false }));

            assertOwnership(false);
            sinon.assert.calledWithExactly(getConfigurationStub, 'python', undefined);
        });
    });

    const folderCases: {
        name: string;
        inherited: SettingValues;
        folders: (boolean | undefined)[];
        expected: boolean;
    }[] = [
        {
            name: 'a single folder true overrides workspace and user false',
            inherited: { globalValue: false, workspaceValue: false },
            folders: [true],
            expected: true,
        },
        {
            name: 'all folders true override workspace false',
            inherited: { workspaceValue: false },
            folders: [true, true],
            expected: true,
        },
        {
            name: 'one folder false disables the whole window',
            inherited: { globalValue: true },
            folders: [true, false],
            expected: false,
        },
        {
            name: 'an unset folder inherits workspace false',
            inherited: { workspaceValue: false },
            folders: [true, undefined],
            expected: false,
        },
        {
            name: 'workspace true overrides user and experiment false in every folder',
            inherited: { defaultValue: false, globalValue: false, workspaceValue: true },
            folders: [undefined, undefined],
            expected: true,
        },
        {
            name: 'an unset folder inherits experiment false',
            inherited: { defaultValue: false },
            folders: [true, undefined],
            expected: false,
        },
        {
            name: 'unset folders without a treatment default to enabled',
            inherited: {},
            folders: [undefined, undefined],
            expected: true,
        },
    ];
    folderCases.forEach(({ name, inherited, folders, expected }) => {
        test(`Uses folder precedence: ${name}`, () => {
            const workspaceFolders = folders.map((workspaceFolderValue, index) => {
                const uri = Uri.parse(`file:///workspace/folder${index}`);
                getConfigurationStub
                    .withArgs('python', uri)
                    .returns(configuration({ ...inherited, workspaceFolderValue }));
                return { uri, name: `folder${index}`, index };
            });
            getWorkspaceFoldersStub.returns(workspaceFolders);
            getConfigurationStub.withArgs('python', undefined).returns(configuration(inherited));

            assertOwnership(expected);
            assert.isTrue(getConfigurationStub.firstCall.args[1] instanceof Uri);
        });
    });

    [false, true].forEach((enabled) => {
        test(`Keeps ownership aligned until reload after an initial ${enabled} decision`, () => {
            getConfigurationStub.returns(configuration({ defaultValue: enabled }));
            assert.strictEqual(api.useEnvExtension(), enabled);

            getConfigurationStub.returns(configuration({ globalValue: !enabled }));

            assertOwnership(enabled);
        });
    });
});
