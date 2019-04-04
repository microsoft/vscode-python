// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import {
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    ILiveShareTestingApi
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { Commands } from '../../client/datascience/constants';
import { HistoryMessageListener } from '../../client/datascience/history/historyMessageListener';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import {
    ICodeWatcher,
    IDataScienceCommandListener,
    IHistory,
    IHistoryProvider,
    IJupyterExecution
} from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { createDocument } from './editor-integration/helpers';
import { addMockData, CellPosition, verifyHtmlOnCell } from './historyTestHelpers';
import { waitForUpdate } from './reactHelpers';

//tslint:disable:trailing-comma no-any no-multiline-string

// tslint:disable-next-line:max-func-body-length no-any
suite('LiveShare tests', () => {
    const disposables: Disposable[] = [];
    let hostContainer: DataScienceIocContainer;
    let guestContainer: DataScienceIocContainer;

    setup(() => {
        hostContainer = createContainer(vsls.Role.Host);
        guestContainer = createContainer(vsls.Role.Guest);
    });

    teardown(async () => {
        for (const disposable of disposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
        await hostContainer.dispose();
        await guestContainer.dispose();
    });

    function createContainer(role: vsls.Role): DataScienceIocContainer {
        const result = new DataScienceIocContainer();
        result.registerDataScienceTypes();

        // Setup our webview panel
        result.createWebView(() => mount(<MainPanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />), role);

        // Make sure the history provider and execution factory in the container is created (the extension does this on startup in the extension)
        const historyProvider = result.get<IHistoryProvider>(IHistoryProvider);
        result.get<IJupyterExecution>(IJupyterExecution);

        // The history provider create needs to be rewritten to make the history window think the mounted web panel is
        // ready.
        const origFunc = (historyProvider as any).create.bind(historyProvider);
        (historyProvider as any).create = async (): Promise<void> => {
            await origFunc();
            const history = historyProvider.getActive();

            // During testing the MainPanel sends the init message before our history is created.
            // Pretend like it's happening now
            const listener = ((history as any).messageListener) as HistoryMessageListener;
            listener.onMessage(HistoryMessages.Started, {});
        };

        return result;
    }

    function getOrCreateHistory(role: vsls.Role): Promise<IHistory> {
        // Get the container to use based on the role.
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        return container!.get<IHistoryProvider>(IHistoryProvider).getOrCreateActive();
    }

    function isSessionStarted(role: vsls.Role): boolean {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        const api = container!.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
        return api.isSessionStarted;
    }

    async function waitForResults(role: vsls.Role, resultGenerator: (both: boolean) => Promise<void>, expectedRenderCount: number = 5): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;

        // If just the host session has started or nobody, just run the host.
        const guestStarted = isSessionStarted(vsls.Role.Guest);
        if (!guestStarted) {
            const hostRenderPromise = waitForUpdate(hostContainer.wrapper!, MainPanel, expectedRenderCount);

            // Generate our results
            await resultGenerator(false);

            // Wait for all of the renders to go through
            await hostRenderPromise;
        } else {
            // Otherwise more complicated. We have to wait for renders on both

            // Get a render promise with the expected number of renders for both wrappers
            const hostRenderPromise = waitForUpdate(hostContainer.wrapper!, MainPanel, expectedRenderCount);
            const guestRenderPromise = waitForUpdate(guestContainer.wrapper!, MainPanel, expectedRenderCount);

            // Generate our results
            await resultGenerator(true);

            // Wait for all of the renders to go through
            await Promise.all([hostRenderPromise, guestRenderPromise]);
        }
        return container.wrapper!;
    }

    async function addCodeToRole(role: vsls.Role, code: string, expectedRenderCount: number = 5): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
        return waitForResults(role, async (both: boolean) => {
            if (!both) {
                const history = await getOrCreateHistory(role);
                return history.addCode(code, 'foo.py', 2);
            } else {
                // Add code to the apropriate container
                const host = await getOrCreateHistory(vsls.Role.Host);
                const guest = await getOrCreateHistory(vsls.Role.Guest);
                return (role === vsls.Role.Host ? host.addCode(code, 'foo.py', 2) : guest.addCode(code, 'foo.py', 2));
            }
        }, expectedRenderCount);
    }

    function startSession(role: vsls.Role): Promise<void> {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        const api = container!.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
        return api.startSession();
    }

    function stopSession(role: vsls.Role): Promise<void> {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        const api = container!.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
        return api.stopSession();
    }

    test('Host alone', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Start the host session first
        await startSession(vsls.Role.Host);

        // Just run some code in the host
        const wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

    test('Host & Guest Simple', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Create the host history and then the guest history
        await getOrCreateHistory(vsls.Role.Host);
        await startSession(vsls.Role.Host);
        await getOrCreateHistory(vsls.Role.Guest);
        await startSession(vsls.Role.Guest);

        // Send code through the host
        const wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        // Verify it ended up on the guest too
        assert.ok(guestContainer.wrapper, 'Guest wrapper not created');
        verifyHtmlOnCell(guestContainer.wrapper!, '<span>1</span>', CellPosition.Last);
    });

    test('Host Shutdown and Run', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Create the host history and then the guest history
        await getOrCreateHistory(vsls.Role.Host);
        await startSession(vsls.Role.Host);

        // Send code through the host
        let wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        // Stop the session
        await stopSession(vsls.Role.Host);

        // Send code again. It should still work.
        wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

    test('Host startup and guest restart', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Start the host, and add some data
        const host = await getOrCreateHistory(vsls.Role.Host);
        await startSession(vsls.Role.Host);

        // Send code through the host
        let wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        // Shutdown the host
        await host.dispose();

        // Startup a guest and run some code.
        await startSession(vsls.Role.Guest);
        wrapper = await addCodeToRole(vsls.Role.Guest, 'a=1\na');
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);

        assert.ok(hostContainer.wrapper, 'Host wrapper not created');
        verifyHtmlOnCell(hostContainer.wrapper!, '<span>1</span>', CellPosition.Last);
    });

    test('Going through codewatcher', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, '#%%\na=1\na', 1);

        // Start both the host and the guest
        await startSession(vsls.Role.Host);
        await startSession(vsls.Role.Guest);

        // Setup a document and text
        const fileName = 'test.py';
        const version = 1;
        const inputText = '#%%\na=1\na';
        const document = createDocument(inputText, fileName, version, TypeMoq.Times.atLeastOnce());
        document.setup(doc => doc.getText(TypeMoq.It.isAny())).returns(() => inputText);

        const codeWatcher = guestContainer!.get<ICodeWatcher>(ICodeWatcher);
        codeWatcher.setDocument(document.object);

        // Send code using a codewatcher instead (we're sending it through the guest)
        const wrapper = await waitForResults(vsls.Role.Guest, async (both: boolean) => {
            // Should always be both
            assert.ok(both, 'Expected both guest and host to be used');
            await codeWatcher.runAllCells();
        });
        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
        assert.ok(hostContainer.wrapper, 'Host wrapper not created for some reason');
        verifyHtmlOnCell(hostContainer.wrapper!, '<span>1</span>', CellPosition.Last);
    });

    test('Export from guest', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, '#%%\na=1\na', 1);

        // Remap the fileSystem so we control the write for the notebook. Have to do this
        // before the listener is created so that it uses this file system.
        let outputContents: string | undefined;
        const fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        guestContainer!.serviceManager.rebindInstance<IFileSystem>(IFileSystem, fileSystem.object);
        fileSystem.setup(f => f.writeFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_f, c) => {
            outputContents = c.toString();
            return Promise.resolve();
        });
        fileSystem.setup(f => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => true);
        fileSystem.setup(f => f.getSubDirectories(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));

        // Need to register commands as our extension isn't actually loading.
        const listener = guestContainer!.get<IDataScienceCommandListener>(IDataScienceCommandListener);
        const guestCommandManager = guestContainer!.get<ICommandManager>(ICommandManager);
        listener.register(guestCommandManager);

        // Start both the host and the guest
        await startSession(vsls.Role.Host);
        await startSession(vsls.Role.Guest);

        // Create a document on the guest
        guestContainer!.addDocument('#%%\na=1\na', 'foo.py');
        guestContainer!.get<IDocumentManager>(IDocumentManager).showTextDocument(Uri.file('foo.py'));

        // Attempt to export a file from the guest by running an ExportFileAndOutputAsNotebook
        const executePromise = guestCommandManager.executeCommand(Commands.ExportFileAndOutputAsNotebook, Uri.file('foo.py')) as Promise<Uri>;
        assert.ok(executePromise, 'Export file did not return a promise');
        const savedUri = await executePromise;
        assert.ok(savedUri, 'Uri not returned from export');
        assert.equal(savedUri.fsPath, 'test.ipynb', 'Export did not work');
        assert.ok(outputContents, 'Output not exported');
        assert.ok(outputContents!.includes('data'), 'Output is empty');
    });

});
