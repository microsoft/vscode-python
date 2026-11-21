// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { EventEmitter } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/node';
import { Commands } from '../../../client/activation/commands';
import { ICommandManager } from '../../../client/common/application/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { JediLanguageServerManager } from '../../../client/activation/jedi/manager';
import { JediLanguageServerProxy } from '../../../client/activation/jedi/languageServerProxy';
import { ILanguageClientFactory, ILanguageServerAnalysisOptions, ILanguageServerProxy } from '../../../client/activation/types';

suite('Language Server - Jedi LS Manager and Proxy', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('JediLanguageServerManager', () => {
        let commandManager: ICommandManager;
        let registeredCommandHandler: (() => Promise<void> | void) | undefined;
        let analysisOptions: ILanguageServerAnalysisOptions;
        let onDidChangeEventEmitter: EventEmitter<void>;
        let languageServerProxy: ILanguageServerProxy;
        let serviceContainer: IServiceContainer;

        setup(() => {
            onDidChangeEventEmitter = new EventEmitter<void>();
            analysisOptions = {
                onDidChange: onDidChangeEventEmitter.event,
                initialize: sandbox.stub().resolves(),
                getAnalysisOptions: sandbox.stub().resolves({} as LanguageClientOptions),
                dispose: sandbox.stub(),
            };
            languageServerProxy = {
                start: sandbox.stub().resolves(),
                stop: sandbox.stub().resolves(),
                dispose: sandbox.stub(),
                loadExtension: sandbox.stub(),
            };
            commandManager = ({
                registerCommand: (command: string, handler: () => Promise<void> | void) => {
                    if (command === Commands.RestartLS) {
                        registeredCommandHandler = handler;
                    }
                    return { dispose: () => {} };
                },
            } as unknown) as ICommandManager;
            serviceContainer = ({
                get: sandbox.stub(),
            } as unknown) as IServiceContainer;
        });

        teardown(() => {
            onDidChangeEventEmitter.dispose();
        });

        test('RestartLS command returns a promise that resolves when restart finishes', async () => {
            const manager = new JediLanguageServerManager(
                serviceContainer,
                analysisOptions,
                languageServerProxy,
                commandManager,
            );

            assert.notStrictEqual(registeredCommandHandler, undefined);

            // Before start is called, executing restart should return a promise that safely no-ops
            const resultBeforeStart = registeredCommandHandler!();
            assert.ok(resultBeforeStart instanceof Promise);
            await resultBeforeStart;
            assert.strictEqual((languageServerProxy.start as sinon.SinonStub).called, false);

            // Now start the manager
            await manager.start(undefined, { path: 'python' } as PythonEnvironment);
            assert.strictEqual((languageServerProxy.start as sinon.SinonStub).callCount, 1);

            // Calling restart command should return the restart promise and execute stop/start
            const restartPromise = registeredCommandHandler!();
            assert.ok(restartPromise instanceof Promise);
            await restartPromise;
            assert.strictEqual((languageServerProxy.stop as sinon.SinonStub).callCount, 1);
            assert.strictEqual((languageServerProxy.start as sinon.SinonStub).callCount, 2);

            manager.dispose();
        });

        test('Overlapping restart calls are queued and serialized sequentially', async () => {
            const manager = new JediLanguageServerManager(
                serviceContainer,
                analysisOptions,
                languageServerProxy,
                commandManager,
            );

            await manager.start(undefined, { path: 'python' } as PythonEnvironment);
            (languageServerProxy.start as sinon.SinonStub).resetHistory();
            (languageServerProxy.stop as sinon.SinonStub).resetHistory();

            let concurrentStarts = 0;
            let maxConcurrentStarts = 0;

            (languageServerProxy.start as sinon.SinonStub).callsFake(async () => {
                concurrentStarts += 1;
                maxConcurrentStarts = Math.max(maxConcurrentStarts, concurrentStarts);
                await new Promise((resolve) => setTimeout(resolve, 10));
                concurrentStarts -= 1;
            });

            // Trigger two restarts concurrently
            const p1 = registeredCommandHandler!();
            const p2 = registeredCommandHandler!();

            await Promise.all([p1, p2]);

            // They should run sequentially, never exceeding 1 concurrent start
            assert.strictEqual(maxConcurrentStarts, 1);
            assert.strictEqual((languageServerProxy.stop as sinon.SinonStub).callCount, 2);
            assert.strictEqual((languageServerProxy.start as sinon.SinonStub).callCount, 2);

            manager.dispose();
        });
    });

    suite('JediLanguageServerProxy', () => {
        test('Stops and disposes client if stop() is called while start() is awaiting', async () => {
            let startCalled = false;
            let stopCalled = false;
            let disposeCalled = false;

            const fakeClient = ({
                _serverProcess: { pid: 12345 },
                onNotification: () => ({ dispose: () => {} }),
                start: async () => {
                    startCalled = true;
                    // Simulate delay during client.start()
                    await new Promise((resolve) => setTimeout(resolve, 20));
                },
                stop: async () => {
                    stopCalled = true;
                },
                dispose: async () => {
                    disposeCalled = true;
                },
            } as unknown) as LanguageClient;

            const clientFactory: ILanguageClientFactory = {
                createLanguageClient: sandbox.stub().resolves(fakeClient),
            };

            const proxy = new JediLanguageServerProxy(clientFactory);

            // Trigger start
            const startPromise = proxy.start(undefined, undefined, {} as LanguageClientOptions);

            // Call stop while start() is in flight
            await new Promise((resolve) => setTimeout(resolve, 5));
            await proxy.stop();

            await startPromise;

            assert.strictEqual(startCalled, true);
            assert.strictEqual(stopCalled, true);
            assert.strictEqual(disposeCalled, true);
        });
    });
});
