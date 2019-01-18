// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { LanguageServerAnalysisOptions } from '../../../client/activation/languageServer/analysisOptions';
import { LanguageServer } from '../../../client/activation/languageServer/languageServer';
import { LanguageServerManager } from '../../../client/activation/languageServer/manager';
import { ILanguageServer, ILanguageServerAnalysisOptions } from '../../../client/activation/types';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../core';

use(chaiAsPromised);

// tslint:disable:max-func-body-length no-any chai-vague-errors no-unused-expression

const loadExtensionCommand = 'python._loadLanguageServerExtension';

suite('Language Server - Manager', () => {
    class LanguageServerManagerTest extends LanguageServerManager {
        public static initializeExtensionArgs(args: {}) {
            LanguageServerManager.loadExtensionArgs = args;
        }
        public clearLoadExtensionArgs() {
            LanguageServerManager.loadExtensionArgs = undefined;
        }
    }
    let manager: LanguageServerManagerTest;
    let serviceContainer: IServiceContainer;
    let analysisOptions: ILanguageServerAnalysisOptions;
    let languageServer: ILanguageServer;
    let commandManager: ICommandManager;
    let onChangeHandler: Function;
    const languageClientOptions = ({ x: 1 } as any) as LanguageClientOptions;
    let commandRegistrationDisposable: typemoq.IMock<IDisposable>;
    setup(() => {
        serviceContainer = mock(ServiceContainer);
        analysisOptions = mock(LanguageServerAnalysisOptions);
        languageServer = mock(LanguageServer);
        commandManager = mock(CommandManager);
        commandRegistrationDisposable = typemoq.Mock.ofType<IDisposable>();
        manager = new LanguageServerManagerTest(
            instance(serviceContainer),
            instance(commandManager),
            instance(analysisOptions)
        );
        manager.clearLoadExtensionArgs();
    });

    [undefined, Uri.file(__filename)].forEach(resource => {
        async function startLanguageServer() {
            when(commandManager.registerCommand(loadExtensionCommand, anything())).thenReturn(
                commandRegistrationDisposable.object
            );

            let handlerRegistered = false;
            const changeFn = (handler: Function) => {
                handlerRegistered = true;
                onChangeHandler = handler;
            };
            when(analysisOptions.initialize(resource)).thenResolve();
            when(analysisOptions.getAnalysisOptions()).thenResolve(languageClientOptions);
            when(analysisOptions.onDidChange).thenReturn(changeFn as any);
            when(serviceContainer.get<ILanguageServer>(ILanguageServer)).thenReturn(instance(languageServer));
            when(languageServer.start(resource, languageClientOptions)).thenResolve();

            await manager.start(resource);

            verify(analysisOptions.initialize(resource)).once();
            verify(analysisOptions.getAnalysisOptions()).once();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).once();
            verify(languageServer.start(resource, languageClientOptions)).once();
            expect(handlerRegistered).to.be.true;
            verify(languageServer.dispose()).never();
            verify(commandManager.registerCommand(loadExtensionCommand, anything())).once();
            commandRegistrationDisposable.verify(d => d.dispose(), typemoq.Times.never());
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
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();
        });
        test('Changes in analysis options must throttled when restarting LS', async () => {
            await startLanguageServer();

            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await Promise.all([
                onChangeHandler.call(manager),
                onChangeHandler.call(manager),
                onChangeHandler.call(manager),
                onChangeHandler.call(manager)
            ]);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();
        });
        test('Multiple changes in analysis options must restart LS twice', async () => {
            await startLanguageServer();

            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await Promise.all([
                onChangeHandler.call(manager),
                onChangeHandler.call(manager),
                onChangeHandler.call(manager),
                onChangeHandler.call(manager)
            ]);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();

            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await onChangeHandler.call(manager);
            await Promise.all([
                onChangeHandler.call(manager),
                onChangeHandler.call(manager),
                onChangeHandler.call(manager),
                onChangeHandler.call(manager)
            ]);
            await sleep(1);

            verify(languageServer.dispose()).twice();

            verify(analysisOptions.getAnalysisOptions()).thrice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).thrice();
            verify(languageServer.start(resource, languageClientOptions)).thrice();
        });
        test('Must register command handler', async () => {
            await startLanguageServer();
            manager.dispose();

            commandRegistrationDisposable.verify(d => d.dispose(), typemoq.Times.once());
        });
        test('Must load extension when command is sent', async () => {
            const args = { x: 1 };
            await startLanguageServer();

            verify(languageServer.loadExtension(args)).never();

            const cb = capture(commandManager.registerCommand).first()[1] as Function;
            cb.call(manager, args);

            verify(languageServer.loadExtension(args)).once();
            commandRegistrationDisposable.verify(d => d.dispose(), typemoq.Times.never());
        });
        test('Must load extension when command was been sent before starting LS', async () => {
            const args = { x: 1 };
            LanguageServerManagerTest.initializeExtensionArgs(args);

            await startLanguageServer();

            verify(languageServer.loadExtension(args)).once();
        });
    });
});
