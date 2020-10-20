// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable, Uri } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient/node';
import { Commands } from '../../../client/activation/commands';
import { DotNetLanguageServerAnalysisOptions } from '../../../client/activation/languageServer/analysisOptions';
import { LanguageServerExtension } from '../../../client/activation/languageServer/languageServerExtension';
import { DotNetLanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import { DotNetLanguageServerProxy } from '../../../client/activation/languageServer/languageServerProxy';
import { DotNetLanguageServerManager } from '../../../client/activation/languageServer/manager';
import {
    ILanguageServerAnalysisOptions,
    ILanguageServerExtension,
    ILanguageServerFolderService,
    ILanguageServerProxy
} from '../../../client/activation/types';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../core';

use(chaiAsPromised);

// tslint:disable:max-func-body-length no-any chai-vague-errors no-unused-expression

suite('Language Server - Manager', () => {
    let manager: DotNetLanguageServerManager;
    let serviceContainer: IServiceContainer;
    let analysisOptions: ILanguageServerAnalysisOptions;
    let languageServer: ILanguageServerProxy;
    let lsExtension: ILanguageServerExtension;
    let onChangeAnalysisHandler: Function;
    let folderService: ILanguageServerFolderService;
    let commandManager: ICommandManager;
    const languageClientOptions = ({ x: 1 } as any) as LanguageClientOptions;
    setup(() => {
        serviceContainer = mock(ServiceContainer);
        analysisOptions = mock(DotNetLanguageServerAnalysisOptions);
        languageServer = mock(DotNetLanguageServerProxy);
        lsExtension = mock(LanguageServerExtension);
        folderService = mock(DotNetLanguageServerFolderService);

        commandManager = mock(CommandManager);
        const disposable = mock(Disposable);
        when(commandManager.registerCommand(Commands.RestartLS, anything())).thenReturn(instance(disposable));

        manager = new DotNetLanguageServerManager(
            instance(serviceContainer),
            instance(analysisOptions),
            instance(lsExtension),
            instance(folderService),
            instance(commandManager)
        );
    });

    [undefined, Uri.file(__filename)].forEach((resource) => {
        async function startLanguageServer() {
            let invoked = false;
            const lsExtensionChangeFn = (_handler: Function) => {
                invoked = true;
            };
            when(lsExtension.invoked).thenReturn(lsExtensionChangeFn as any);

            let analysisHandlerRegistered = false;
            const analysisChangeFn = (handler: Function) => {
                analysisHandlerRegistered = true;
                onChangeAnalysisHandler = handler;
            };
            when(analysisOptions.initialize(resource, undefined)).thenResolve();
            when(analysisOptions.getAnalysisOptions()).thenResolve(languageClientOptions);
            when(analysisOptions.onDidChange).thenReturn(analysisChangeFn as any);
            when(serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy)).thenReturn(instance(languageServer));
            when(languageServer.start(resource, undefined, languageClientOptions)).thenResolve();

            await manager.start(resource, undefined);

            verify(analysisOptions.initialize(resource, undefined)).once();
            verify(analysisOptions.getAnalysisOptions()).once();
            verify(serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy)).once();
            verify(languageServer.start(resource, undefined, languageClientOptions)).once();
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

            await expect(manager.start(resource, undefined)).to.eventually.be.rejectedWith(
                'Language server already started'
            );
        });
        test('Changes in analysis options must restart LS', async () => {
            await startLanguageServer();

            await onChangeAnalysisHandler.call(manager);
            await sleep(1);

            verify(languageServer.dispose()).once();

            verify(analysisOptions.getAnalysisOptions()).twice();
            verify(serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy)).twice();
            verify(languageServer.start(resource, undefined, languageClientOptions)).twice();
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
            verify(serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy)).twice();
            verify(languageServer.start(resource, undefined, languageClientOptions)).twice();
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
            verify(serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy)).twice();
            verify(languageServer.start(resource, undefined, languageClientOptions)).twice();

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
            verify(serviceContainer.get<ILanguageServerProxy>(ILanguageServerProxy)).thrice();
            verify(languageServer.start(resource, undefined, languageClientOptions)).thrice();
        });
        test('Must load extension when command was been sent before starting LS', async () => {
            const args = { x: 1 };
            when(lsExtension.loadExtensionArgs).thenReturn(args as any);

            await startLanguageServer();

            verify(languageServer.loadExtension(args)).once();
        });
    });
});
