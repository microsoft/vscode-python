// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import { BaseLanguageClientFactory } from '../../../client/activation/languageServer/languageClientFactory';
import { LanguageServer } from '../../../client/activation/languageServer/languageServer';
import { ILanaguageServer, ILanguageClientFactory } from '../../../client/activation/types';
import '../../../client/common/extensions';
import { IDisposable } from '../../../client/common/types';
import { sleep } from '../../../client/common/utils/async';

//tslint:disable:no-require-imports no-require-imports no-var-requires no-any no-unnecessary-class max-func-body-length

suite('Language Server - LanguageServer', () => {
    let clientFactory: ILanguageClientFactory;
    let server: ILanaguageServer;
    let client: typemoq.IMock<LanguageClient>;
    setup(() => {
        client = typemoq.Mock.ofType<LanguageClient>();
        clientFactory = mock(BaseLanguageClientFactory);
        server = new LanguageServer(instance(clientFactory));
    });
    teardown(() => {
        client.setup(c => c.stop()).returns(() => Promise.resolve());
        server.dispose();
    });
    test('Loading extension will not throw an error if not activated', () => {
        expect(() => server.loadExtension()).not.throw();
    });
    test('Loading extension will not throw an error if not activated but after it loads message will be sent', async () => {
        const loadExtensionArgs = { x: 1 };

        expect(() => server.loadExtension({ a: '2' })).not.throw();

        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;
        client.setup(c => (c as any).then).returns(() => undefined);
        when(clientFactory.createLanguageClient(uri, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup(c => c.stop()).returns(() => Promise.resolve());
        client
            .setup(c => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());
        client
            .setup(c =>
                c.sendRequest(typemoq.It.isValue('python/loadExtension'), typemoq.It.isValue(loadExtensionArgs))
            )
            .returns(() => Promise.resolve(undefined) as any);

        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
        client
            .setup(c => c.initializeResult)
            .returns(() => false as any)
            .verifiable(typemoq.Times.once());

        server.start(uri, options).ignoreErrors();

        // Even though server has started request should not yet be sent out.
        // Not untill language client has initialized.
        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        // // Initialize language client and verify that the request was sent out.
        client
            .setup(c => c.initializeResult)
            .returns(() => true as any)
            .verifiable(typemoq.Times.once());
        await sleep(120);

        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.atLeast(2));
    });
    test('Send telemetry when LS has started and disposes appropriately', async () => {
        const loadExtensionArgs = { x: 1 };
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;
        client.setup(c => (c as any).then).returns(() => undefined);
        when(clientFactory.createLanguageClient(uri, options)).thenResolve(client.object);
        const startDisposable = typemoq.Mock.ofType<IDisposable>();
        client.setup(c => c.stop()).returns(() => Promise.resolve());
        client
            .setup(c => c.start())
            .returns(() => startDisposable.object)
            .verifiable(typemoq.Times.once());
        client
            .setup(c =>
                c.sendRequest(typemoq.It.isValue('python/loadExtension'), typemoq.It.isValue(loadExtensionArgs))
            )
            .returns(() => Promise.resolve(undefined) as any);

        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
        client
            .setup(c => c.initializeResult)
            .returns(() => false as any)
            .verifiable(typemoq.Times.once());

        const promise = server.start(uri, options);

        // Even though server has started request should not yet be sent out.
        // Not untill language client has initialized.
        expect(() => server.loadExtension(loadExtensionArgs)).not.throw();
        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());

        // // Initialize language client and verify that the request was sent out.
        client
            .setup(c => c.initializeResult)
            .returns(() => true as any)
            .verifiable(typemoq.Times.once());
        await sleep(120);
        expect(() => server.loadExtension(loadExtensionArgs)).to.not.throw();
        client.verify(c => c.sendRequest(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.once());
        client.verify(c => c.stop(), typemoq.Times.never());

        await promise;
        server.dispose();

        client.verify(c => c.stop(), typemoq.Times.once());
        startDisposable.verify(d => d.dispose(), typemoq.Times.once());
    });
});
