// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, Uri, WorkspaceFolder } from 'vscode';
import { DocumentFilter } from 'vscode-languageclient';

import { DotNetLanguageServerAnalysisOptions } from '../../../client/activation/languageServer/analysisOptions';
import { DotNetLanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import { ILanguageServerFolderService, ILanguageServerOutputChannel } from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PYTHON_LANGUAGE } from '../../../client/common/constants';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import {
    IConfigurationService,
    IDisposable,
    IExtensionContext,
    IOutputChannel,
    IPathUtils
} from '../../../client/common/types';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { sleep } from '../../core';

// tslint:disable:no-unnecessary-override no-any chai-vague-errors no-unused-expression max-func-body-length

suite('Language Server - Analysis Options', () => {
    class TestClass extends DotNetLanguageServerAnalysisOptions {
        public getDocumentFilters(workspaceFolder?: WorkspaceFolder): DocumentFilter[] {
            return super.getDocumentFilters(workspaceFolder);
        }
        public getExcludedFiles(): string[] {
            return super.getExcludedFiles();
        }
        public getVsCodeExcludeSection(setting: string, list: string[]): void {
            return super.getVsCodeExcludeSection(setting, list);
        }
        public getPythonExcludeSection(list: string[]): void {
            return super.getPythonExcludeSection(list);
        }
        public getTypeshedPaths(): string[] {
            return super.getTypeshedPaths();
        }
        public onSettingsChanged(): void {
            return super.onSettingsChanged();
        }
        public async notifyIfValuesHaveChanged(oldArray: string[], newArray: string[]): Promise<void> {
            return super.notifyIfValuesHaveChanged(oldArray, newArray);
        }
    }
    let analysisOptions: TestClass;
    let context: typemoq.IMock<IExtensionContext>;
    let envVarsProvider: IEnvironmentVariablesProvider;
    let configurationService: IConfigurationService;
    let workspace: IWorkspaceService;
    let outputChannel: IOutputChannel;
    let lsOutputChannel: typemoq.IMock<ILanguageServerOutputChannel>;
    let pathUtils: IPathUtils;
    let lsFolderService: ILanguageServerFolderService;
    setup(() => {
        context = typemoq.Mock.ofType<IExtensionContext>();
        envVarsProvider = mock(EnvironmentVariablesProvider);
        configurationService = mock(ConfigurationService);
        workspace = mock(WorkspaceService);
        outputChannel = typemoq.Mock.ofType<IOutputChannel>().object;
        lsOutputChannel = typemoq.Mock.ofType<ILanguageServerOutputChannel>();
        lsOutputChannel.setup((l) => l.channel).returns(() => outputChannel);
        pathUtils = mock(PathUtils);
        lsFolderService = mock(DotNetLanguageServerFolderService);
        analysisOptions = new TestClass(
            context.object,
            instance(envVarsProvider),
            instance(configurationService),
            instance(workspace),
            lsOutputChannel.object,
            instance(pathUtils),
            instance(lsFolderService)
        );
    });
    test('Initialize will add event handlers and will dispose them when running dispose', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable3 = typemoq.Mock.ofType<IDisposable>();
        when(workspace.onDidChangeConfiguration).thenReturn(() => disposable1.object);
        when(envVarsProvider.onDidEnvironmentVariablesChange).thenReturn(() => disposable3.object);

        await analysisOptions.initialize(undefined, undefined);

        verify(workspace.onDidChangeConfiguration).once();
        verify(envVarsProvider.onDidEnvironmentVariablesChange).once();

        disposable1.setup((d) => d.dispose()).verifiable(typemoq.Times.once());
        disposable3.setup((d) => d.dispose()).verifiable(typemoq.Times.once());

        analysisOptions.dispose();

        disposable1.verifyAll();
        disposable3.verifyAll();
    });
    test('Changes to settings or interpreter will be debounced', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable3 = typemoq.Mock.ofType<IDisposable>();
        let configChangedHandler!: Function;
        when(workspace.onDidChangeConfiguration).thenReturn((cb) => {
            configChangedHandler = cb;
            return disposable1.object;
        });
        when(envVarsProvider.onDidEnvironmentVariablesChange).thenReturn(() => disposable3.object);
        let settingsChangedInvokedCount = 0;
        analysisOptions.onDidChange(() => (settingsChangedInvokedCount += 1));

        await analysisOptions.initialize(undefined, undefined);
        expect(configChangedHandler).to.not.be.undefined;

        for (let i = 0; i < 100; i += 1) {
            configChangedHandler.call(analysisOptions);
        }
        expect(settingsChangedInvokedCount).to.be.equal(0);

        await sleep(10);

        expect(settingsChangedInvokedCount).to.be.equal(1);
    });
    test('If there are no changes then no events will be fired', async () => {
        analysisOptions.getExcludedFiles = () => [];
        analysisOptions.getTypeshedPaths = () => [];

        let eventFired = false;
        analysisOptions.onDidChange(() => (eventFired = true));

        analysisOptions.onSettingsChanged();
        await sleep(10);

        expect(eventFired).to.be.equal(false);
    });
    test('Event must be fired if excluded files are different', async () => {
        analysisOptions.getExcludedFiles = () => ['1'];
        analysisOptions.getTypeshedPaths = () => [];

        let eventFired = false;
        analysisOptions.onDidChange(() => (eventFired = true));

        analysisOptions.onSettingsChanged();
        await sleep(10);

        expect(eventFired).to.be.equal(true);
    });
    test('Event must be fired if typeshed files are different', async () => {
        analysisOptions.getExcludedFiles = () => [];
        analysisOptions.getTypeshedPaths = () => ['1'];

        let eventFired = false;
        analysisOptions.onDidChange(() => (eventFired = true));

        analysisOptions.onSettingsChanged();
        await sleep(10);

        expect(eventFired).to.be.equal(true);
    });
    test('Event must be fired if interpreter info is different', async () => {
        let eventFired = false;
        analysisOptions.onDidChange(() => (eventFired = true));

        analysisOptions.onSettingsChanged();
        await sleep(10);

        expect(eventFired).to.be.equal(true);
    });
    test('Changes to settings will be filtered to current resource', async () => {
        const uri = Uri.file(__filename);
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable3 = typemoq.Mock.ofType<IDisposable>();
        let configChangedHandler!: Function;
        let envVarChangedHandler!: Function;
        when(workspace.onDidChangeConfiguration).thenReturn((cb) => {
            configChangedHandler = cb;
            return disposable1.object;
        });
        when(envVarsProvider.onDidEnvironmentVariablesChange).thenReturn((cb) => {
            envVarChangedHandler = cb;
            return disposable3.object;
        });
        let settingsChangedInvokedCount = 0;

        analysisOptions.onDidChange(() => (settingsChangedInvokedCount += 1));
        await analysisOptions.initialize(uri, undefined);
        expect(configChangedHandler).to.not.be.undefined;
        expect(envVarChangedHandler).to.not.be.undefined;

        for (let i = 0; i < 100; i += 1) {
            const event = typemoq.Mock.ofType<ConfigurationChangeEvent>();
            event
                .setup((e) => e.affectsConfiguration(typemoq.It.isValue('python'), typemoq.It.isValue(uri)))
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            configChangedHandler.call(analysisOptions, event.object);

            event.verifyAll();
        }
        expect(settingsChangedInvokedCount).to.be.equal(0);

        await sleep(10);

        expect(settingsChangedInvokedCount).to.be.equal(1);
    });
    test('Ensure search pattern is not provided when there are no workspaces', () => {
        when(workspace.workspaceFolders).thenReturn([]);

        const expectedSelector = [
            { scheme: 'file', language: PYTHON_LANGUAGE },
            { scheme: 'untitled', language: PYTHON_LANGUAGE },
            { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
            { scheme: 'vscode-notebook-cell', language: PYTHON_LANGUAGE }
        ];

        const selector = analysisOptions.getDocumentFilters();

        expect(selector).to.deep.equal(expectedSelector);
    });
    test('Ensure search pattern is not provided in single-root workspaces', () => {
        const workspaceFolder: WorkspaceFolder = { name: '', index: 0, uri: Uri.file(__dirname) };
        when(workspace.workspaceFolders).thenReturn([workspaceFolder]);

        const expectedSelector = [
            { scheme: 'file', language: PYTHON_LANGUAGE },
            { scheme: 'untitled', language: PYTHON_LANGUAGE },
            { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
            { scheme: 'vscode-notebook-cell', language: PYTHON_LANGUAGE }
        ];

        const selector = analysisOptions.getDocumentFilters(workspaceFolder);

        expect(selector).to.deep.equal(expectedSelector);
    });
    test('Ensure search pattern is provided in a multi-root workspace', () => {
        const workspaceFolder1 = { name: '1', index: 0, uri: Uri.file(__dirname) };
        const workspaceFolder2 = { name: '2', index: 1, uri: Uri.file(__dirname) };
        when(workspace.workspaceFolders).thenReturn([workspaceFolder1, workspaceFolder2]);

        const expectedSelector = [
            { scheme: 'file', language: PYTHON_LANGUAGE, pattern: `${workspaceFolder1.uri.fsPath}/**/*` },
            { scheme: 'untitled', language: PYTHON_LANGUAGE },
            { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
            { scheme: 'vscode-notebook-cell', language: PYTHON_LANGUAGE }
        ];

        const selector = analysisOptions.getDocumentFilters(workspaceFolder1);

        expect(selector).to.deep.equal(expectedSelector);
    });
});
