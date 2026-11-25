// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { LanguageClientOptions } from 'vscode-languageclient/node';
import { NodeLanguageServerProxy } from '../../client/activation/node/languageServerProxy';
import { ILanguageClientFactory } from '../../client/activation/types';
import { ILanguageServerOutputChannel } from '../../client/activation/types';
import { IWorkspaceService, ICommandManager, IApplicationShell } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import {
    IExperimentService,
    IConfigurationService,
    IInterpreterPathService,
    IExtensions,
} from '../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { PylanceLSExtensionManager } from '../../client/languageServer/pylanceLSExtensionManager';

suite('Language Server - Pylance LS extension manager', () => {
    let manager: PylanceLSExtensionManager;

    setup(() => {
        manager = new PylanceLSExtensionManager(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {} as IExperimentService,
            {} as IWorkspaceService,
            {} as IConfigurationService,
            {} as IInterpreterPathService,
            {} as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                registerCommand: () => {
                    /** do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            {} as IExtensions,
            {} as IApplicationShell,
        );
    });

    suite('Language Server - Pylance lifecycle compatibility', () => {
        for (const selfManaged of [false, true]) {
            test(`Python ${selfManaged ? 'delegates' : 'manages'} the Pylance client lifecycle`, async () => {
                const start = sinon.stub().resolves();
                const stop = sinon.stub().resolves();
                const restart = sinon.stub().resolves();
                const createLanguageClient = sinon.stub();
                const proxy = new NodeLanguageServerProxy(
                    ({ createLanguageClient } as unknown) as ILanguageClientFactory,
                    {} as IExperimentService,
                    {} as IInterpreterPathService,
                    {} as IEnvironmentVariablesProvider,
                    {} as IWorkspaceService,
                    ({
                        getExtension: () => ({
                            isActive: true,
                            packageJSON: { version: '1.0.0' },
                            exports: {
                                client: {
                                    supportsSelfManagedLifecycle: selfManaged,
                                    isEnabled: () => true,
                                    start,
                                    stop,
                                    restart,
                                },
                            },
                        }),
                    } as unknown) as IExtensions,
                );

                await proxy.start(undefined, undefined, {} as LanguageClientOptions);
                assert.strictEqual(start.callCount, selfManaged ? 0 : 1);
                assert.strictEqual(createLanguageClient.callCount, 0);
                assert.strictEqual(await proxy.restartSelfManagedClient(), selfManaged);
                assert.strictEqual(restart.callCount, selfManaged ? 1 : 0);
                await proxy.stop();
                assert.strictEqual(stop.callCount, selfManaged ? 0 : 1);
            });
        }
    });

    test('Constructor should create a client proxy, a server manager and a server proxy', () => {
        assert.notStrictEqual(manager.clientFactory, undefined);
        assert.notStrictEqual(manager.serverManager, undefined);
    });

    test('canStartLanguageServer should return true if Pylance is installed', () => {
        manager = new PylanceLSExtensionManager(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {} as IExperimentService,
            {} as IWorkspaceService,
            {} as IConfigurationService,
            {} as IInterpreterPathService,
            {} as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                registerCommand: () => {
                    /** do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => ({}),
            } as unknown) as IExtensions,
            {} as IApplicationShell,
        );

        const result = manager.canStartLanguageServer();

        assert.strictEqual(result, true);
    });

    test('canStartLanguageServer should return false if Pylance is not installed', () => {
        manager = new PylanceLSExtensionManager(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {} as IExperimentService,
            {} as IWorkspaceService,
            {} as IConfigurationService,
            {} as IInterpreterPathService,
            {} as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
            } as unknown) as IExtensions,
            {} as IApplicationShell,
        );

        const result = manager.canStartLanguageServer();

        assert.strictEqual(result, false);
    });
});
