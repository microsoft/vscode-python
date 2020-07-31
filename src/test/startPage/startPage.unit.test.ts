// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as typemoq from 'typemoq';
import { Memento } from 'vscode';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWebPanelProvider,
    IWorkspaceService
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { StartPage } from '../../client/common/startPage/startPage';
import { IStartPage } from '../../client/common/startPage/types';
import { IConfigurationService, IExtensionContext } from '../../client/common/types';
import { ICodeCssGenerator, INotebookEditorProvider, IThemeFinder } from '../../client/datascience/types';
import { MockPythonSettings } from '../datascience/mockPythonSettings';
import { MockAutoSelectionService } from '../mocks/autoSelector';

suite('StartPage tests', () => {
    let startPage: IStartPage;
    let provider: typemoq.IMock<IWebPanelProvider>;
    let cssGenerator: typemoq.IMock<ICodeCssGenerator>;
    let themeFinder: typemoq.IMock<IThemeFinder>;
    let configuration: typemoq.IMock<IConfigurationService>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let file: typemoq.IMock<IFileSystem>;
    let notebookEditorProvider: typemoq.IMock<INotebookEditorProvider>;
    let commandManager: typemoq.IMock<ICommandManager>;
    let documentManager: typemoq.IMock<IDocumentManager>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let context: typemoq.IMock<IExtensionContext>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let memento: typemoq.IMock<Memento>;
    const dummySettings = new MockPythonSettings(undefined, new MockAutoSelectionService());

    function setupVersions(savedVersion: string, actualVersion: string) {
        context.setup((c) => c.globalState).returns(() => memento.object);
        memento.setup((m) => m.get(typemoq.It.isAnyString())).returns(() => savedVersion);
        memento
            .setup((m) => m.update(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        const packageJson = {
            version: actualVersion
        };
        appEnvironment.setup((ae) => ae.packageJson).returns(() => packageJson);
    }

    function reset() {
        context.reset();
        memento.reset();
        appEnvironment.reset();
    }

    setup(async () => {
        provider = typemoq.Mock.ofType<IWebPanelProvider>();
        cssGenerator = typemoq.Mock.ofType<ICodeCssGenerator>();
        themeFinder = typemoq.Mock.ofType<IThemeFinder>();
        configuration = typemoq.Mock.ofType<IConfigurationService>();
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        file = typemoq.Mock.ofType<IFileSystem>();
        notebookEditorProvider = typemoq.Mock.ofType<INotebookEditorProvider>();
        commandManager = typemoq.Mock.ofType<ICommandManager>();
        documentManager = typemoq.Mock.ofType<IDocumentManager>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        context = typemoq.Mock.ofType<IExtensionContext>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        memento = typemoq.Mock.ofType<Memento>();

        configuration.setup((cs) => cs.getSettings(undefined)).returns(() => dummySettings);

        startPage = new StartPage(
            provider.object,
            cssGenerator.object,
            themeFinder.object,
            configuration.object,
            workspaceService.object,
            file.object,
            notebookEditorProvider.object,
            commandManager.object,
            documentManager.object,
            appShell.object,
            context.object,
            appEnvironment.object
        );
    });

    test('Check extension version', async () => {
        let savedVersion: string;
        let actualVersion: string;

        // Version has not changed
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.6.0-dev';
        setupVersions(savedVersion, actualVersion);

        const test1 = await startPage.extensionVersionChanged();
        assert.equal(test1, false, 'The version is the same, start page should not open.');
        reset();

        // actual version is older
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.5.0-dev';
        setupVersions(savedVersion, actualVersion);

        const test2 = await startPage.extensionVersionChanged();
        assert.equal(test2, false, 'The actual version is older, start page should not open.');
        reset();

        // actual version is newer
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.6.1';
        setupVersions(savedVersion, actualVersion);

        const test3 = await startPage.extensionVersionChanged();
        assert.equal(test3, true, 'The actual version is newer, start page should open.');
        reset();
    });
});
