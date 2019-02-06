// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { LanguageServerAnalysisOptions } from '../../../client/activation/languageServer/analysisOptions';
import { LanguageServer } from '../../../client/activation/languageServer/languageServer';
import { LanguageServerExtension, LanguageServerManager } from '../../../client/activation/languageServer/manager';
import { ILanguageServer, ILanguageServerAnalysisOptions, ILanguageServerExtension } from '../../../client/activation/types';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../core';

use(chaiAsPromised);

// tslint:disable:max-func-body-length no-any chai-vague-errors no-unused-expression

const loadExtensionCommand = 'python._loadLanguageServerExtension';

suite('xLanguage Server - Manager', () => {
    class LanguageServerExtensionTest extends LanguageServerExtension {
        // tslint:disable-next-line:no-unnecessary-override
        public async register(): Promise<void> {
            return super.register();
        }
        public clearLoadExtensionArgs() {
            super.loadExtensionArgs = undefined;
        }
    }
    let manager: LanguageServerManager;
    let serviceContainer: IServiceContainer;
    let analysisOptions: ILanguageServerAnalysisOptions;
    let languageServer: ILanguageServer;
    let commandManager: ICommandManager;
    let lsExtension: ILanguageServerExtension;
    let onChangeAnalysisHandler: Function;
    let onChangeLSExtensionHandler: Function;
    const languageClientOptions = ({ x: 1 } as any) as LanguageClientOptions;
    let commandRegistrationDisposable: typemoq.IMock<IDisposable>;
    let extension: LanguageServerExtensionTest;
    setup(() => {
        serviceContainer = mock(ServiceContainer);
        analysisOptions = mock(LanguageServerAnalysisOptions);
        languageServer = mock(LanguageServer);
        commandManager = mock(CommandManager);
        lsExtension = mock(LanguageServerExtension);
        commandRegistrationDisposable = typemoq.Mock.ofType<IDisposable>();
        manager = new LanguageServerManager(
            instance(serviceContainer),
            instance(analysisOptions),
            instance(lsExtension)
        );
        extension = new LanguageServerExtensionTest(instance(commandManager));
        extension.clearLoadExtensionArgs();
    });

    [undefined, Uri.file(__filename)].forEach(resource => {
        async function startLanguageServer() {
            let invoked = false;
            const lsExtensionChangeFn = (handler: Function) => {
                invoked = true;
                onChangeLSExtensionHandler = handler;
            };
            when(lsExtension.invoked).thenReturn(lsExtensionChangeFn as any);

            let analysisHandlerRegistered = false;
            const analysisChangeFn = (handler: Function) => {
                analysisHandlerRegistered = true;
                onChangeAnalysisHandler = handler;
            };
            when(analysisOptions.initialize(resource)).thenResolve();
            when(analysisOptions.getAnalysisOptions()).thenResolve(languageClientOptions);
            when(analysisOptions.onDidChange).thenReturn(analysisChangeFn as any);
            when(serviceContainer.get<ILanguageServer>(ILanguageServer)).thenReturn(instance(languageServer));
            when(languageServer.start(resource, languageClientOptions)).thenResolve();

            await manager.start(resource);

            verify(analysisOptions.initialize(resource)).once();
            verify(analysisOptions.getAnalysisOptions()).once();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).once();
            verify(languageServer.start(resource, languageClientOptions)).once();
            expect(invoked).to.be.true;
            expect(analysisHandlerRegistered).to.be.true;
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

            await onChangeAnalysisHandler.call(manager);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();
        });
        test('Changes in analysis options must throttled when restarting LS', async () => {
            await startLanguageServer();

            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await Promise.all([
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager)
            ]);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();
        });
        test('Multiple changes in analysis options must restart LS twice', async () => {
            await startLanguageServer();

            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await Promise.all([
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager)
            ]);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).twice();
            verify(languageServer.start(resource, languageClientOptions)).twice();

            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await onChangeAnalysisHandler.call(manager);
            await Promise.all([
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager),
                onChangeAnalysisHandler.call(manager)
            ]);
            await sleep(1);

            verify(languageServer.dispose()).twice();

            verify(analysisOptions.getAnalysisOptions()).thrice();
            verify(serviceContainer.get<ILanguageServer>(ILanguageServer)).thrice();
            verify(languageServer.start(resource, languageClientOptions)).thrice();
        });
        test('Must load extension when command was been sent before starting LS', async () => {
            const args = { x: 1 };
            when(lsExtension.loadExtensionArgs).thenReturn(args as any);

            await startLanguageServer();

            verify(languageServer.loadExtension(args)).once();
        });
    });
    suite('Test LanguageServerExtension', () => {
        let cmdManager: ICommandManager;
        setup(() => {
            cmdManager = mock(CommandManager);
            commandRegistrationDisposable = typemoq.Mock.ofType<IDisposable>();
            extension = new LanguageServerExtensionTest(instance(cmdManager));
        });
        test('Must register command handler', async () => {
            when(cmdManager.registerCommand(loadExtensionCommand, anything())).thenReturn(
                commandRegistrationDisposable.object
            );
            await extension.register();
            verify(cmdManager.registerCommand(loadExtensionCommand, anything())).once();
            extension.dispose();
            commandRegistrationDisposable.verify(d => d.dispose(), typemoq.Times.once());
        });
    });
});
