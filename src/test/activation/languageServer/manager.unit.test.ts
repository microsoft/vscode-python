// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { LanguageServerAnalysisOptions } from '../../../client/activation/languageServer/analysisOptions';
import { LanguageServer } from '../../../client/activation/languageServer/languageServer';
import { LanguageServerManager } from '../../../client/activation/languageServer/manager';
import { ILanaguageServer, ILanguageServerAnalysisOptions, ILanguageServerManager } from '../../../client/activation/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../core';

use(chaiAsPromised);

// tslint:disable:max-func-body-length no-any chai-vague-errors no-unused-expression

suite('Language Server - Manager', () => {
    let manager: ILanguageServerManager;
    let serviceContainer: IServiceContainer;
    let analysisOptions: ILanguageServerAnalysisOptions;
    let languageServer: ILanaguageServer;
    let onChangeHandler: Function;
    const languageClientOptions = { x: 1 } as any as LanguageClientOptions;
    setup(() => {
        serviceContainer = mock(ServiceContainer);
        analysisOptions = mock(LanguageServerAnalysisOptions);
        languageServer = mock(LanguageServer);
        manager = new LanguageServerManager(instance(serviceContainer), instance(analysisOptions));
    });

    [undefined, Uri.file(__filename)].forEach(resource => {
        async function startLanguageServer() {
            let handlerRegistered = false;
            const changeFn = (handler: Function) => { handlerRegistered = true; onChangeHandler = handler; };
            when(analysisOptions.initialize(resource)).thenResolve();
            when(analysisOptions.getAnalysisOptions()).thenResolve(languageClientOptions);
            when(analysisOptions.onDidChange).thenReturn(changeFn as any);
            when(serviceContainer.get<ILanaguageServer>(ILanaguageServer)).thenReturn(instance(languageServer));
            when(languageServer.start(resource, languageClientOptions)).thenResolve();

            await manager.start(resource);

            verify(analysisOptions.initialize(resource)).once();
            verify(analysisOptions.getAnalysisOptions()).once();
            verify(serviceContainer.get<ILanaguageServer>(ILanaguageServer)).once();
            verify(languageServer.start(resource, languageClientOptions)).once();
            expect(handlerRegistered).to.be.true;
            verify(languageServer.dispose()).never();
        }
        test('Start must register handlers and initialize analysis options', async () => {
            await startLanguageServer();

            manager.dispose();

            verify(languageServer.dispose()).once();
        });
        test('Attempting to start LS will throw an exception', async () => {
            await startLanguageServer();

            await expect(manager.start(resource)).to.eventually.be.rejectedWith('Language Server already started');
        });
        test('Changes in analysis options must restart LS', async () => {
            await startLanguageServer();

            await onChangeHandler.call(manager);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanaguageServer>(ILanaguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();
        });
        test('Changes in analysis options must throttled when restarting LS', async () => {
            await startLanguageServer();

            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await Promise.all([onChangeHandler.call(manager),
            onChangeHandler.call(manager),
            onChangeHandler.call(manager),
            onChangeHandler.call(manager)]);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanaguageServer>(ILanaguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();
        });
        test('Multiple changes in analysis options must restart LS twice', async () => {
            await startLanguageServer();

            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await Promise.all([onChangeHandler.call(manager),
            onChangeHandler.call(manager),
            onChangeHandler.call(manager),
            onChangeHandler.call(manager)]);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanaguageServer>(ILanaguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();

            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await Promise.all([onChangeHandler.call(manager),
            onChangeHandler.call(manager),
            onChangeHandler.call(manager),
            onChangeHandler.call(manager)]);
            await sleep(1);

            verify(languageServer.dispose()).twice();

            verify(analysisOptions.getAnalysisOptions()).thrice();
            verify(serviceContainer.get<ILanaguageServer>(ILanaguageServer)).thrice();
            verify(languageServer.start(resource, languageClientOptions)).thrice();
        });
    });
});
