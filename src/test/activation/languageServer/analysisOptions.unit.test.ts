// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, Uri } from 'vscode';
import { LanguageServerAnalysisOptions } from '../../../client/activation/languageServer/analysisOptions';
import { InterpreterDataService } from '../../../client/activation/languageServer/interpreterDataService';
import { LanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import { IInterpreterDataService, ILanguageServerFolderService } from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { IConfigurationService, IDisposable, IExtensionContext, IOutputChannel, IPathUtils, IPythonExtensionBanner } from '../../../client/common/types';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { ProposeLanguageServerBanner } from '../../../client/languageServices/proposeLanguageServerBanner';
import { sleep } from '../../core';

// tslint:disable:no-unnecessary-override no-any chai-vague-errors no-unused-expression max-func-body-length

suite('Language Server - Analysis Options', () => {
    class TestClass extends LanguageServerAnalysisOptions {
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
        public async onSettingsChanged(): Promise<void> {
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
    let surveyBanner: IPythonExtensionBanner;
    let interpreterService: IInterpreterService;
    let outputChannel: IOutputChannel;
    let pathUtils: IPathUtils;
    let lsFolderService: ILanguageServerFolderService;
    let interpreterDataService: IInterpreterDataService;
    setup(() => {
        context = typemoq.Mock.ofType<IExtensionContext>();
        envVarsProvider = mock(EnvironmentVariablesProvider);
        configurationService = mock(ConfigurationService);
        workspace = mock(WorkspaceService);
        surveyBanner = mock(ProposeLanguageServerBanner);
        interpreterService = mock(InterpreterService);
        outputChannel = typemoq.Mock.ofType<IOutputChannel>().object;
        pathUtils = mock(PathUtils);
        interpreterDataService = mock(InterpreterDataService);
        lsFolderService = mock(LanguageServerFolderService);
        analysisOptions = new TestClass(context.object, instance(envVarsProvider),
            instance(configurationService),
            instance(workspace), instance(surveyBanner),
            instance(interpreterService), instance(interpreterDataService), outputChannel,
            instance(pathUtils), instance(lsFolderService));
    });
    test('Initialize will add event handlers and will dispose them when running dispose', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        when(workspace.onDidChangeConfiguration).thenReturn(() => disposable1.object);
        when(interpreterService.onDidChangeInterpreter).thenReturn(() => disposable2.object);

        await analysisOptions.initialize(undefined);

        verify(workspace.onDidChangeConfiguration).once();
        verify(interpreterService.onDidChangeInterpreter).once();

        disposable1.setup(d => d.dispose()).verifiable(typemoq.Times.once());
        disposable2.setup(d => d.dispose()).verifiable(typemoq.Times.once());

        analysisOptions.dispose();

        disposable1.verifyAll();
        disposable2.verifyAll();
    });
    test('Changes to settings or interpreter will be debounced', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        let configChangedHandler!: Function;
        let interpreterChangedHandler!: Function;
        when(workspace.onDidChangeConfiguration).thenReturn(cb => { configChangedHandler = cb; return disposable1.object; });
        when(interpreterService.onDidChangeInterpreter).thenReturn(cb => { interpreterChangedHandler = cb; return disposable2.object; });
        let settingsChangedInvokedCount = 0;
        when(interpreterDataService.getInterpreterData(undefined))
            .thenCall(() => settingsChangedInvokedCount += 1)
            .thenResolve();

        await analysisOptions.initialize(undefined);
        expect(configChangedHandler).to.not.be.undefined;
        expect(interpreterChangedHandler).to.not.be.undefined;

        for (let i = 0; i < 100; i += 1) {
            configChangedHandler.call(analysisOptions);
            interpreterChangedHandler.call(analysisOptions);
        }
        expect(settingsChangedInvokedCount).to.be.equal(0);

        await sleep(1);

        expect(settingsChangedInvokedCount).to.be.equal(1);
    });
    test('If there are no changes then no events will be fired', async () => {
        when(interpreterDataService.getInterpreterData(undefined))
            .thenResolve({ hash: '' } as any);
        analysisOptions.getExcludedFiles = () => [];
        analysisOptions.getTypeshedPaths = () => [];

        let eventFired = false;
        analysisOptions.onDidChange(() => eventFired = true);

        await analysisOptions.onSettingsChanged();
        await sleep(1);

        expect(eventFired).to.be.equal(false);
    });
    test('Event must be fired if excluded files are different', async () => {
        when(interpreterDataService.getInterpreterData(undefined))
            .thenResolve();
        analysisOptions.getExcludedFiles = () => ['1'];
        analysisOptions.getTypeshedPaths = () => [];

        let eventFired = false;
        analysisOptions.onDidChange(() => eventFired = true);

        await analysisOptions.onSettingsChanged();
        await sleep(1);

        expect(eventFired).to.be.equal(true);
    });
    test('Event must be fired if typeshed files are different', async () => {
        when(interpreterDataService.getInterpreterData(undefined))
            .thenResolve();
        analysisOptions.getExcludedFiles = () => [];
        analysisOptions.getTypeshedPaths = () => ['1'];

        let eventFired = false;
        analysisOptions.onDidChange(() => eventFired = true);

        await analysisOptions.onSettingsChanged();
        await sleep(1);

        expect(eventFired).to.be.equal(true);
    });
    test('Event must be fired if interpreter info is different', async () => {
        when(interpreterDataService.getInterpreterData({ hash: '1234' } as any))
            .thenResolve();

        let eventFired = false;
        analysisOptions.onDidChange(() => eventFired = true);

        await analysisOptions.onSettingsChanged();
        await sleep(1);

        expect(eventFired).to.be.equal(true);
    });
    test('Changes to settings will be filtered to current resoruce', async () => {
        const uri = Uri.file(__filename);
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        let configChangedHandler!: Function;
        let interpreterChangedHandler!: Function;
        when(workspace.onDidChangeConfiguration).thenReturn(cb => { configChangedHandler = cb; return disposable1.object; });
        when(interpreterService.onDidChangeInterpreter).thenReturn(cb => { interpreterChangedHandler = cb; return disposable2.object; });
        let settingsChangedInvokedCount = 0;
        when(interpreterDataService.getInterpreterData(uri)).thenResolve();

        analysisOptions.onDidChange(() => settingsChangedInvokedCount += 1);
        await analysisOptions.initialize(uri);
        expect(configChangedHandler).to.not.be.undefined;
        expect(interpreterChangedHandler).to.not.be.undefined;

        settingsChangedInvokedCount = 0;
        for (let i = 0; i < 100; i += 1) {
            const event = typemoq.Mock.ofType<ConfigurationChangeEvent>();
            event.setup(e => e.affectsConfiguration(typemoq.It.isValue('python'), typemoq.It.isValue(uri)))
                .verifiable(typemoq.Times.once());
            configChangedHandler.call(analysisOptions, event.object);
            interpreterChangedHandler.call(analysisOptions);

            event.verifyAll();
        }
        expect(settingsChangedInvokedCount).to.be.equal(0);

        await sleep(1);

        expect(settingsChangedInvokedCount).to.be.equal(1);
    });
});
