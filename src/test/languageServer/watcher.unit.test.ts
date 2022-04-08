// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { ConfigurationChangeEvent, Disposable } from 'vscode';
import { ILanguageServerOutputChannel, LanguageServerType } from '../../client/activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import {
    IConfigurationService,
    IExperimentService,
    IExtensions,
    IInterpreterPathService,
} from '../../client/common/types';
import { LanguageService } from '../../client/common/utils/localize';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { NoneLSExtensionManager } from '../../client/languageServer/noneLSExtensionManager';
import { LanguageServerWatcher } from '../../client/languageServer/watcher';
import * as Logging from '../../client/logging';

suite('Language server watcher', () => {
    let watcher: LanguageServerWatcher;
    const sandbox = sinon.createSandbox();

    setup(() => {
        watcher = new LanguageServerWatcher(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {
                getSettings: () => ({ languageServer: LanguageServerType.None }),
            } as IConfigurationService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            ({
                getActiveInterpreter: () => 'python',
                onDidChangeInterpreter: () => {
                    /* do nothing */
                },
            } as unknown) as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                onDidChangeConfiguration: () => {
                    /* do nothing */
                },
            } as unknown) as IWorkspaceService,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            [] as Disposable[],
        );
    });

    teardown(() => {
        sandbox.restore();
    });

    test('The constructor should add a listener to onDidChangeInterpreter to the list of disposables if it is a trusted workspace', () => {
        const disposables: Disposable[] = [];

        watcher = new LanguageServerWatcher(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {
                getSettings: () => ({ languageServer: LanguageServerType.None }),
            } as IConfigurationService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            ({
                onDidChangeInterpreter: () => {
                    /* do nothing */
                },
            } as unknown) as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                isTrusted: true,
                onDidChangeConfiguration: () => {
                    /* do nothing */
                },
            } as unknown) as IWorkspaceService,
            {} as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            disposables,
        );

        assert.strictEqual(disposables.length, 4);
    });

    test('The constructor should not add a listener to onDidChangeInterpreter to the list of disposables if it is not a trusted workspace', () => {
        const disposables: Disposable[] = [];

        watcher = new LanguageServerWatcher(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {
                getSettings: () => ({ languageServer: LanguageServerType.None }),
            } as IConfigurationService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            ({
                onDidChangeInterpreter: () => {
                    /* do nothing */
                },
            } as unknown) as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                isTrusted: false,
                onDidChangeConfiguration: () => {
                    /* do nothing */
                },
            } as unknown) as IWorkspaceService,
            {} as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            disposables,
        );

        assert.strictEqual(disposables.length, 3);
    });

    test(`When starting the language server, the language server extension manager should not be undefined`, async () => {
        // First start
        await watcher.startLanguageServer(LanguageServerType.None);
        const extensionManager = watcher.languageServerExtensionManager!;

        assert.notStrictEqual(extensionManager, undefined);
    });

    test(`When starting the language server, if the interpreter changed, the existing language server should be stopped if there is one`, async () => {
        const getActiveInterpreterStub = sandbox.stub();
        getActiveInterpreterStub.onFirstCall().returns('python');
        getActiveInterpreterStub.onSecondCall().returns('other/python');

        const interpreterService = ({
            onDidChangeInterpreter: () => {
                /* do nothing */
            },
            getActiveInterpreter: getActiveInterpreterStub,
        } as unknown) as IInterpreterService;

        watcher = new LanguageServerWatcher(
            ({
                get: () => {
                    /* do nothing */
                },
            } as unknown) as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {
                getSettings: () => ({ languageServer: LanguageServerType.None }),
            } as IConfigurationService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            interpreterService,
            ({
                onDidEnvironmentVariablesChange: () => {
                    /* do nothing */
                },
            } as unknown) as IEnvironmentVariablesProvider,
            ({
                isTrusted: true,
                getWorkspaceFolder: () => undefined,
                onDidChangeConfiguration: () => {
                    /* do nothing */
                },
            } as unknown) as IWorkspaceService,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            [] as Disposable[],
        );

        // First start, get the reference to the extension manager.
        await watcher.startLanguageServer(LanguageServerType.None);

        const extensionManager = watcher.languageServerExtensionManager!;
        const stopLanguageServerSpy = sandbox.spy(extensionManager, 'stopLanguageServer');

        // Second start, check if the first server manager was stopped and disposed of.
        await watcher.startLanguageServer(LanguageServerType.None);

        assert.ok(stopLanguageServerSpy.calledOnce);
    });

    test(`When starting the language server, if the language server can be started, it should call startLanguageServer on the language server extension manager`, async () => {
        const startLanguageServerStub = sandbox.stub(NoneLSExtensionManager.prototype, 'startLanguageServer');
        startLanguageServerStub.returns(Promise.resolve());

        await watcher.startLanguageServer(LanguageServerType.None);

        assert.ok(startLanguageServerStub.calledOnce);
    });

    test(`When starting the language server, if the language server can be started, there should be logs written in the output channel`, async () => {
        let output = '';
        sandbox.stub(Logging, 'traceLog').callsFake((...args: unknown[]) => {
            output = output.concat(...(args as string[]));
        });

        watcher = new LanguageServerWatcher(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {
                getSettings: () => ({ languageServer: LanguageServerType.None }),
            } as IConfigurationService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            ({
                getActiveInterpreter: () => 'python',
                onDidChangeInterpreter: () => {
                    /* do nothing */
                },
            } as unknown) as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                onDidChangeConfiguration: () => {
                    /* do nothing */
                },
            } as unknown) as IWorkspaceService,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            [] as Disposable[],
        );

        await watcher.startLanguageServer(LanguageServerType.None);

        assert.strictEqual(output, LanguageService.startingNone());
    });

    test(`When starting the language server, if the language server can be started, this.languageServerType should reflect the new language server type`, async () => {
        await watcher.startLanguageServer(LanguageServerType.None);

        assert.deepStrictEqual(watcher.languageServerType, LanguageServerType.None);
    });

    test(`When starting the language server, if the language server cannot be started, it should call languageServerNotAvailable`, async () => {
        const canStartLanguageServerStub = sandbox.stub(NoneLSExtensionManager.prototype, 'canStartLanguageServer');
        canStartLanguageServerStub.returns(false);
        const languageServerNotAvailableStub = sandbox.stub(
            NoneLSExtensionManager.prototype,
            'languageServerNotAvailable',
        );
        languageServerNotAvailableStub.returns(Promise.resolve());

        await watcher.startLanguageServer(LanguageServerType.None);

        assert.ok(canStartLanguageServerStub.calledOnce);
        assert.ok(languageServerNotAvailableStub.calledOnce);
    });

    test('When the config settings change, but the python.languageServer setting is not affected, the watched should not restart the language server', async () => {
        let onDidChangeConfigListener: (event: ConfigurationChangeEvent) => Promise<void> = () => Promise.resolve();

        const workspaceService = ({
            onDidChangeConfiguration: (listener: (event: ConfigurationChangeEvent) => Promise<void>) => {
                onDidChangeConfigListener = listener;
            },
        } as unknown) as IWorkspaceService;

        watcher = new LanguageServerWatcher(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            {
                getSettings: () => ({ languageServer: LanguageServerType.None }),
            } as IConfigurationService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            ({
                getActiveInterpreter: () => 'python',
                onDidChangeInterpreter: () => {
                    /* do nothing */
                },
            } as unknown) as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            workspaceService,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            [] as Disposable[],
        );

        const startLanguageServerSpy = sandbox.spy(watcher, 'startLanguageServer');

        await watcher.startLanguageServer(LanguageServerType.None);

        await onDidChangeConfigListener({ affectsConfiguration: () => false });

        // Check that startLanguageServer was only called once: When we called it above.
        assert.ok(startLanguageServerSpy.calledOnce);
    });

    test('When the config settings change, and the python.languageServer setting is affected, the watched should restart the language server', async () => {
        let onDidChangeConfigListener: (event: ConfigurationChangeEvent) => Promise<void> = () => Promise.resolve();

        const workspaceService = ({
            onDidChangeConfiguration: (listener: (event: ConfigurationChangeEvent) => Promise<void>) => {
                onDidChangeConfigListener = listener;
            },
        } as unknown) as IWorkspaceService;

        const getSettingsStub = sandbox.stub();
        getSettingsStub.onFirstCall().returns({ languageServer: LanguageServerType.None });
        getSettingsStub.onSecondCall().returns({ languageServer: LanguageServerType.Node });

        const configService = ({
            getSettings: getSettingsStub,
        } as unknown) as IConfigurationService;

        watcher = new LanguageServerWatcher(
            {} as IServiceContainer,
            {} as ILanguageServerOutputChannel,
            configService,
            {} as IExperimentService,
            {} as IInterpreterPathService,
            ({
                getActiveInterpreter: () => 'python',
                onDidChangeInterpreter: () => {
                    /* do nothing */
                },
            } as unknown) as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            workspaceService,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
            {} as IFileSystem,
            ({
                getExtension: () => undefined,
                onDidChange: () => {
                    /* do nothing */
                },
            } as unknown) as IExtensions,
            {} as IApplicationShell,
            [] as Disposable[],
        );

        // Use a fake here so we don't actually start up language servers.
        const startLanguageServerFake = sandbox.fake.resolves(undefined);
        sandbox.replace(watcher, 'startLanguageServer', startLanguageServerFake);
        await watcher.startLanguageServer(LanguageServerType.None);

        await onDidChangeConfigListener({ affectsConfiguration: () => true });

        // Check that startLanguageServer was called twice: When we called it above, and implicitly because of the event.
        assert.ok(startLanguageServerFake.calledTwice);
    });
});
