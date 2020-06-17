// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    ILiveShareTestingApi
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { Commands } from '../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    ICodeWatcher,
    IDataScienceCommandListener,
    IInteractiveWindow,
    IInteractiveWindowProvider,
    IJupyterExecution
} from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { createDocument } from './editor-integration/helpers';
import { MockFileSystem } from './mockFileSystem';
import { mountNativeWebView } from './nativeEditorTestHelpers';
import { addMockData, CellPosition, mountConnectedMainPanel, verifyHtmlOnCell } from './testHelpers';

//import { asyncDump } from '../common/asyncDump';
//tslint:disable:trailing-comma no-any no-multiline-string

// tslint:disable-next-line:max-func-body-length no-any
suite('DataScience LiveShare tests', () => {
    const disposables: Disposable[] = [];
    let hostContainer: DataScienceIocContainer;
    let guestContainer: DataScienceIocContainer;
    let lastErrorMessage: string | undefined;

    setup(async () => {
        hostContainer = createContainer(vsls.Role.Host);
        guestContainer = createContainer(vsls.Role.Guest);
        return Promise.all([hostContainer.activate(), guestContainer.activate()]);
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
        if (hostContainer) {
            await hostContainer.dispose();
        }
        if (guestContainer) {
            await guestContainer.dispose();
        }
        lastErrorMessage = undefined;
    });

    suiteTeardown(() => {
        //asyncDump();
    });

    function createContainer(role: vsls.Role): DataScienceIocContainer {
        const result = new DataScienceIocContainer();
        result.registerDataScienceTypes();

        // Rebind the appshell so we can change what happens on an error
        const dummyDisposable = {
            dispose: () => {
                return;
            }
        };
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString())).returns((e) => (lastErrorMessage = e));
        appShell
            .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(''));
        appShell
            .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_a1: string, a2: string, _a3: string) => Promise.resolve(a2));
        appShell
            .setup((a) => a.showSaveDialog(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(Uri.file('test.ipynb')));
        appShell.setup((a) => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);

        result.serviceManager.rebindInstance<IApplicationShell>(IApplicationShell, appShell.object);

        // Setup our webview panel
        result.createWebView(() => mountConnectedMainPanel('interactive'), 'default', role);

        // Make sure the history provider and execution factory in the container is created (the extension does this on startup in the extension)
        // This is necessary to get the appropriate live share services up and running.
        result.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        result.get<IJupyterExecution>(IJupyterExecution);
        return result;
    }

    async function getOrCreateInteractiveWindow(role: vsls.Role): Promise<IInteractiveWindow> {
        // Get the container to use based on the role.
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        const window = await container!.get<IInteractiveWindowProvider>(IInteractiveWindowProvider).getOrCreateActive();
        await window.show();
        return window;
    }

    function isSessionStarted(role: vsls.Role): boolean {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        const api = container!.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
        return api.isSessionStarted;
    }

    async function waitForResults(
        role: vsls.Role,
        resultGenerator: (both: boolean) => Promise<void>
    ): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;

        // If just the host session has started or nobody, just run the host.
        const guestStarted = isSessionStarted(vsls.Role.Guest);
        if (!guestStarted) {
            // NOTE: These tests aren't going to work unless there's more than just 'notebook' and 'default'
            const hostRenderPromise = hostContainer
                .getWebPanel('default')
                .waitForMessage(InteractiveWindowMessages.ExecutionRendered);

            // Generate our results
            await resultGenerator(false);

            // Wait for all of the renders to go through
            await hostRenderPromise;
        } else {
            // Otherwise more complicated. We have to wait for renders on both

            // Get a render promise with the expected number of renders for both wrappers
            const hostRenderPromise = hostContainer
                .getWebPanel('default')
                .waitForMessage(InteractiveWindowMessages.ExecutionRendered);
            const guestRenderPromise = guestContainer
                .getWebPanel('default')
                .waitForMessage(InteractiveWindowMessages.ExecutionRendered);

            // Generate our results
            await resultGenerator(true);

            // Wait for all of the renders to go through. Guest may have been shutdown by now.
            await Promise.all([
                hostRenderPromise,
                isSessionStarted(vsls.Role.Guest) ? guestRenderPromise : Promise.resolve()
            ]);
        }
        return container.getDefaultWrapper();
    }

    async function addCodeToRole(
        role: vsls.Role,
        code: string
    ): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
        return waitForResults(role, async (both: boolean) => {
            if (!both) {
                const history = await getOrCreateInteractiveWindow(role);
                await history.addCode(code, Uri.file('foo.py').fsPath, 2);
            } else {
                // Add code to the apropriate container
                const host = await getOrCreateInteractiveWindow(vsls.Role.Host);

                // Make sure guest is still creatable
                if (isSessionStarted(vsls.Role.Guest)) {
                    const guest = await getOrCreateInteractiveWindow(vsls.Role.Guest);
                    role === vsls.Role.Host
                        ? await host.addCode(code, Uri.file('foo.py').fsPath, 2)
                        : await guest.addCode(code, Uri.file('foo.py').fsPath, 2);
                } else {
                    await host.addCode(code, Uri.file('foo.py').fsPath, 2);
                }
            }
        });
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

    function disableGuestChecker(role: vsls.Role) {
        const container = role === vsls.Role.Host ? hostContainer : guestContainer;
        const api = container!.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
        api.disableGuestChecker();
    }

    test('Host alone', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Start the host session first
        await startSession(vsls.Role.Host);

        // Just run some code in the host
        const wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
    });

    test('Host & Guest Simple', async function () {
        // tslint:disable-next-line: no-invalid-this
        return this.skip();
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Create the host history and then the guest history
        await getOrCreateInteractiveWindow(vsls.Role.Host);
        await startSession(vsls.Role.Host);
        await getOrCreateInteractiveWindow(vsls.Role.Guest);
        await startSession(vsls.Role.Guest);

        // Send code through the host
        const wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);

        // Verify it ended up on the guest too
        assert.ok(guestContainer.getDefaultWrapper(), 'Guest wrapper not created');
        verifyHtmlOnCell(guestContainer.getDefaultWrapper()!, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
    });

    test('Host starts LiveShare after starting Jupyter', async function () {
        // tslint:disable-next-line: no-invalid-this
        return this.skip();
        addMockData(hostContainer!, 'a=1\na', 1);
        addMockData(hostContainer!, 'b=2\nb', 2);
        await getOrCreateInteractiveWindow(vsls.Role.Host);
        let wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);

        await startSession(vsls.Role.Host);
        await getOrCreateInteractiveWindow(vsls.Role.Guest);
        await startSession(vsls.Role.Guest);

        wrapper = await addCodeToRole(vsls.Role.Host, 'b=2\nb');

        assert.ok(guestContainer.getDefaultWrapper(), 'Guest wrapper not created');
        verifyHtmlOnCell(guestContainer.getDefaultWrapper()!, 'InteractiveCell', '<span>2</span>', CellPosition.Last);
    });

    test('Host Shutdown and Run', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Create the host history and then the guest history
        await getOrCreateInteractiveWindow(vsls.Role.Host);
        await startSession(vsls.Role.Host);

        // Send code through the host
        let wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);

        // Stop the session
        await stopSession(vsls.Role.Host);

        // Send code again. It should still work.
        wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
    });

    test('Host startup and guest restart', async function () {
        // tslint:disable-next-line: no-invalid-this
        return this.skip();
        // Should only need mock data in host
        addMockData(hostContainer!, 'a=1\na', 1);

        // Start the host, and add some data
        const host = await getOrCreateInteractiveWindow(vsls.Role.Host);
        await startSession(vsls.Role.Host);

        // Send code through the host
        let wrapper = await addCodeToRole(vsls.Role.Host, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);

        // Shutdown the host
        await host.dispose();

        // Startup a guest and run some code.
        await startSession(vsls.Role.Guest);
        wrapper = await addCodeToRole(vsls.Role.Guest, 'a=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);

        assert.ok(hostContainer.getDefaultWrapper(), 'Host wrapper not created');
        verifyHtmlOnCell(hostContainer.getDefaultWrapper()!, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
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
        document.setup((doc) => doc.getText(TypeMoq.It.isAny())).returns(() => inputText);

        const codeWatcher = guestContainer!.get<ICodeWatcher>(ICodeWatcher);
        codeWatcher.setDocument(document.object);

        // Send code using a codewatcher instead (we're sending it through the guest)
        const wrapper = await waitForResults(vsls.Role.Guest, async (both: boolean) => {
            // Should always be both
            assert.ok(both, 'Expected both guest and host to be used');
            await codeWatcher.runAllCells();
        });
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
        assert.ok(hostContainer.getDefaultWrapper(), 'Host wrapper not created for some reason');
        verifyHtmlOnCell(hostContainer.getDefaultWrapper()!, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
    });

    test('Export from guest', async () => {
        const originalFileSystem = guestContainer.get<IFileSystem>(IFileSystem) as MockFileSystem;

        // Should only need mock data in host
        addMockData(hostContainer!, '#%%\na=1\na', 1);

        // Remap the fileSystem so we control the write for the notebook. Have to do this
        // before the listener is created so that it uses this file system.
        let outputContents: string | undefined;
        const fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        guestContainer!.serviceManager.rebindInstance<IFileSystem>(IFileSystem, fileSystem.object);
        fileSystem
            .setup((f) => f.writeFile(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_f, c) => {
                outputContents = c.toString();

                // Tell the mock file system that a certain file exists
                originalFileSystem.addFileContents(Uri.file('test.ipynb').fsPath, outputContents!);

                return Promise.resolve();
            });
        fileSystem.setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => true);
        fileSystem.setup((f) => f.getSubDirectories(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        fileSystem.setup((f) => f.directoryExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));

        // Need to register commands as our extension isn't actually loading.
        const listeners = guestContainer!.getAll<IDataScienceCommandListener>(IDataScienceCommandListener);
        const guestCommandManager = guestContainer!.get<ICommandManager>(ICommandManager);
        listeners.forEach((f) => f.register(guestCommandManager));

        // Start both the host and the guest
        await startSession(vsls.Role.Host);
        await startSession(vsls.Role.Guest);

        // Create a document on the guest
        guestContainer!.addDocument('#%%\na=1\na', Uri.file('foo.py').fsPath);
        guestContainer!.get<IDocumentManager>(IDocumentManager).showTextDocument(Uri.file('foo.py'));

        // Mount the webview for the opening of the editor
        mountNativeWebView(guestContainer);

        // Attempt to export a file from the guest by running an ExportFileAndOutputAsNotebook
        const executePromise = guestCommandManager.executeCommand(
            Commands.ExportFileAndOutputAsNotebook,
            Uri.file('foo.py')
        ) as Promise<Uri>;
        assert.ok(executePromise, 'Export file did not return a promise');
        const savedUri = await executePromise;
        assert.ok(savedUri, 'Uri not returned from export');
        assert.equal(savedUri.fsPath, Uri.file('test.ipynb').fsPath, 'Export did not work');
        assert.ok(outputContents, 'Output not exported');
        assert.ok(outputContents!.includes('data'), 'Output is empty');
    });

    test('Guest does not have extension', async () => {
        // Should only need mock data in host
        addMockData(hostContainer!, '#%%\na=1\na', 1);

        // Start just the host and verify it works
        await startSession(vsls.Role.Host);
        let wrapper = await addCodeToRole(vsls.Role.Host, '#%%\na=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);

        // Disable guest checking on the guest (same as if the guest doesn't have the python extension)
        await startSession(vsls.Role.Guest);
        disableGuestChecker(vsls.Role.Guest);

        // Host should now be in a state that if any code runs, the session should end. However
        // the code should still run
        wrapper = await addCodeToRole(vsls.Role.Host, '#%%\na=1\na');
        verifyHtmlOnCell(wrapper, 'InteractiveCell', '<span>1</span>', CellPosition.Last);
        assert.equal(isSessionStarted(vsls.Role.Host), false, 'Host should have exited session');
        assert.equal(isSessionStarted(vsls.Role.Guest), false, 'Guest should have exited session');
        assert.ok(lastErrorMessage, 'Error was not set during session shutdown');
    });
});
