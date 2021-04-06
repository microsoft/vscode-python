// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { Disposable, LanguageClient, LanguageClientOptions, State, StateChangeEvent } from 'vscode-languageclient/node';
import { DotNetLanguageClientFactory } from '../../../client/activation/languageServer/languageClientFactory';
import { DotNetLanguageServerProxy } from '../../../client/activation/languageServer/languageServerProxy';
import { ILanguageClientFactory } from '../../../client/activation/types';
import { ICommandManager } from '../../../client/common/application/types';
import '../../../client/common/extensions';
import { IConfigurationService, IDisposable, IPythonSettings } from '../../../client/common/types';
import { sleep } from '../../../client/common/utils/async';
import { TestingService } from '../../../client/testing/main';
import { ITestingService } from '../../../client/testing/types';

//tslint:disable:no-require-imports no-require-imports no-var-requires no-any no-unnecessary-class max-func-body-length

suite('Language Server - LanguageServer', () => {
    class LanguageServerTest extends DotNetLanguageServerProxy {
        public async registerTestServices() {
            return super.registerTestServices();
        }
    }
    let clientFactory: ILanguageClientFactory;
    let server: LanguageServerTest;
    let client: typemoq.IMock<LanguageClient>;
    let testManager: ITestingService;
    let configService: typemoq.IMock<IConfigurationService>;
    let commandManager: typemoq.IMock<ICommandManager>;
    let stateChangeListener: ((e: StateChangeEvent) => void) | undefined;
    setup(() => {
        client = typemoq.Mock.ofType<LanguageClient>();
        clientFactory = mock(DotNetLanguageClientFactory);
        testManager = mock(TestingService);
        configService = typemoq.Mock.ofType<IConfigurationService>();

        commandManager = typemoq.Mock.ofType<ICommandManager>();
        commandManager
            .setup((c) => c.registerCommand(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => {
                return typemoq.Mock.ofType<Disposable>().object;
            });
        server = new LanguageServerTest(instance(clientFactory), instance(testManager), configService.object);

        const stateChangeDisposable = typemoq.Mock.ofType<IDisposable>();
        client
            .setup((c) => c.onDidChangeState(typemoq.It.isAny()))
            .returns((listener) => {
                stateChangeListener = listener;
                return stateChangeDisposable.object;
            });
    });
    teardown(() => {
        client.setup((c) => c.stop()).returns(() => Promise.resolve());
        server.dispose();
        stateChangeListener = undefined;
    });

    function sendStartEvent() {
        if (stateChangeListener) {
            stateChangeListener({ newState: State.Running, oldState: State.Starting });
        }
    }

    test('Loading extension will not throw an error if not activated', () => {
        expect(() => server.loadExtension()).not.throw();
    });
    test('Loading extension will not throw an error if not activated but after it loads message will be sent', async () => {
        const loadExtensionArgs = { x: 1 };

        expect(() => server.loadExtension({ a: '2' })).not.throw();

        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;

        const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        configService.setup((c) => c.getSettings(uri)).returns(() => pythonSettings.object);

        const onTelemetryDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.onTelemetry(typemoq.It.isAny())).returns(() => onTelemetryDisposable.object);

        client.setup((c) => (c as any).then).returns(() => undefined);
        when(clientFactory.createLanguageClient(uri, undefined, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.stop()).returns(() => Promise.resolve());
        client
            .setup((c) => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());
        client
            .setup((c) =>
                c.sendRequest(typemoq.It.isValue('python/loadExtension'), typemoq.It.isValue(loadExtensionArgs)),
            )
            .returns(() => Promise.resolve(undefined) as any);

        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
        client
            .setup((c) => c.initializeResult)
            .returns(() => false as any)
            .verifiable(typemoq.Times.once());

        server
            .start(uri, undefined, options)
            .then(async () => sendStartEvent())
            .ignoreErrors();

        // Even though server has started request should not yet be sent out.
        // Not until language client has initialized.
        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        // // Initialize language client and verify that the request was sent out.
        client
            .setup((c) => c.initializeResult)
            .returns(() => true as any)
            .verifiable(typemoq.Times.once());
        await sleep(120);

        verify(testManager.activate(anything())).once();
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.atLeast(2));
    });
    test('Send telemetry when LS has started and disposes appropriately', async () => {
        const loadExtensionArgs = { x: 1 };
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;

        const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        configService.setup((c) => c.getSettings(uri)).returns(() => pythonSettings.object);

        const onTelemetryDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.onTelemetry(typemoq.It.isAny())).returns(() => onTelemetryDisposable.object);

        client.setup((c) => (c as any).then).returns(() => undefined);
        when(clientFactory.createLanguageClient(uri, undefined, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.stop()).returns(() => Promise.resolve());
        client
            .setup((c) => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());
        client
            .setup((c) =>
                c.sendRequest(typemoq.It.isValue('python/loadExtension'), typemoq.It.isValue(loadExtensionArgs)),
            )
            .returns(() => Promise.resolve(undefined) as any);

        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
        client
            .setup((c) => c.initializeResult)
            .returns(() => false as any)
            .verifiable(typemoq.Times.once());

        const promise = server.start(uri, undefined, options).then(async () => sendStartEvent());

        // Even though server has started request should not yet be sent out.
        // Not until language client has initialized.
        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        // // Initialize language client and verify that the request was sent out.
        client
            .setup((c) => c.initializeResult)
            .returns(() => true as any)
            .verifiable(typemoq.Times.once());
        await sleep(120);

        verify(testManager.activate(anything())).once();
        expect(() => server.loadExtension(loadExtensionArgs)).to.not.throw();
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.once());
        client.verify((c) => c.stop(), typemoq.Times.never());

        await promise;
        server.dispose();

        client.verify((c) => c.stop(), typemoq.Times.once());
        startDisposable.verify((d) => d.dispose(), typemoq.Times.once());
    });
    test('Ensure Errors raised when starting test manager are not bubbled up', async () => {
        await server.registerTestServices();
    });
    test('Register telemetry handler if LS was downloadeded', async () => {
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;

        const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        pythonSettings
            .setup((p) => p.downloadLanguageServer)
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        configService
            .setup((c) => c.getSettings(uri))
            .returns(() => pythonSettings.object)
            .verifiable(typemoq.Times.once());

        const onTelemetryDisposable = typemoq.Mock.ofType<IDisposable>();
        client
            .setup((c) => c.onTelemetry(typemoq.It.isAny()))
            .returns(() => onTelemetryDisposable.object)
            .verifiable(typemoq.Times.once());

        client.setup((c) => (c as any).then).returns(() => undefined);
        when(clientFactory.createLanguageClient(uri, undefined, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.stop()).returns(() => Promise.resolve());
        client
            .setup((c) => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());

        server
            .start(uri, undefined, options)
            .then(async () => sendStartEvent())
            .ignoreErrors();

        // Initialize language client and verify that the request was sent out.
        client
            .setup((c) => c.initializeResult)
            .returns(() => true as any)
            .verifiable(typemoq.Times.once());
        await sleep(120);

        verify(testManager.activate(anything())).once();

        client.verify((c) => c.onTelemetry(typemoq.It.isAny()), typemoq.Times.once());
        pythonSettings.verifyAll();
        configService.verifyAll();
    });
    test('Do not register telemetry handler if LS was not downloadeded', async () => {
        client.verify((c) => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;

        const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        pythonSettings
            .setup((p) => p.downloadLanguageServer)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        configService
            .setup((c) => c.getSettings(uri))
            .returns(() => pythonSettings.object)
            .verifiable(typemoq.Times.once());

        const onTelemetryDisposable = typemoq.Mock.ofType<IDisposable>();
        client
            .setup((c) => c.onTelemetry(typemoq.It.isAny()))
            .returns(() => onTelemetryDisposable.object)
            .verifiable(typemoq.Times.once());

        client.setup((c) => (c as any).then).returns(() => undefined);
        when(clientFactory.createLanguageClient(uri, undefined, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.stop()).returns(() => Promise.resolve());
        client
            .setup((c) => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());

        server
            .start(uri, undefined, options)
            .then(async () => sendStartEvent())
            .ignoreErrors();

        // Initialize language client and verify that the request was sent out.
        client
            .setup((c) => c.initializeResult)
            .returns(() => true as any)
            .verifiable(typemoq.Times.once());
        await sleep(120);

        verify(testManager.activate(anything())).once();

        client.verify((c) => c.onTelemetry(typemoq.It.isAny()), typemoq.Times.never());
        pythonSettings.verifyAll();
        configService.verifyAll();
    });
    test('Do not register services if languageClient is disposed while waiting for it to start', async () => {
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;

        const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        pythonSettings
            .setup((p) => p.downloadLanguageServer)
            .returns(() => false)
            .verifiable(typemoq.Times.never());
        configService
            .setup((c) => c.getSettings(uri))
            .returns(() => pythonSettings.object)
            .verifiable(typemoq.Times.never());

        client.setup((c) => (c as any).then).returns(() => undefined);
        client
            .setup((c) => c.initializeResult)
            .returns(() => undefined)
            .verifiable(typemoq.Times.atLeastOnce());
        when(clientFactory.createLanguageClient(uri, undefined, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup((c) => c.stop()).returns(() => Promise.resolve());
        client
            .setup((c) => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());

        const promise = server.start(uri, undefined, options).then(async () => sendStartEvent());
        // Wait until we start ls client and check if it is ready.
        await sleep(200);
        // Confirm we checked if it is ready.
        client.verifyAll();
        // Now dispose the language client.
        server.dispose();
        // Wait until we check if it is ready.
        await sleep(500);

        // Promise should resolve without any errors.
        await promise;

        verify(testManager.activate(anything())).never();
        client.verify((c) => c.onTelemetry(typemoq.It.isAny()), typemoq.Times.never());
        pythonSettings.verifyAll();
        configService.verifyAll();
    });
});
