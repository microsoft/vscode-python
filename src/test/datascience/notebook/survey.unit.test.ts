// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fakeTimers from '@sinonjs/fake-timers';
import { anything, deepEqual, instance, mock, reset, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { IApplicationShell, IVSCodeNotebook, NotebookCellChangedEvent } from '../../../client/common/application/types';
import { IBrowserService, IDisposable, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { CommonSurvey } from '../../../client/common/utils/localize';
import { MillisecondsInADay } from '../../../client/constants';
import {
    NotebookSurveyBanner,
    NotebookSurveyDataLogger,
    NotebookSurveyUsageData
} from '../../../client/datascience/notebook/survey';
import { INotebookEditor, INotebookEditorProvider } from '../../../client/datascience/types';

// tslint:disable: no-any
suite('Data Science - NativeNotebook Survey', () => {
    let stateFactory: IPersistentStateFactory;
    let stateService: IPersistentState<NotebookSurveyUsageData>;
    let state: NotebookSurveyUsageData = {};
    let vscNotebook: IVSCodeNotebook;
    let notebookEditorProvider: INotebookEditorProvider;
    let browser: IBrowserService;
    let shell: IApplicationShell;
    let survey: IExtensionSingleActivationService;
    const disposables: IDisposable[] = [];
    let editor: INotebookEditor;
    const mockDocument = instance(mock<NotebookDocument>());
    let onDidOpenNotebookEditor: EventEmitter<INotebookEditor>;
    let onExecutedCode: EventEmitter<string>;
    let onDidChangeNotebookDocument: EventEmitter<NotebookCellChangedEvent>;
    let clock: fakeTimers.InstalledClock;
    setup(async () => {
        editor = mock<INotebookEditor>();
        onExecutedCode = new EventEmitter<string>();
        when(editor.onExecutedCode).thenReturn(onExecutedCode.event);
        stateFactory = mock<IPersistentStateFactory>();
        stateService = mock<IPersistentState<NotebookSurveyUsageData>>();
        when(stateFactory.createGlobalPersistentState(anything(), anything())).thenReturn(instance(stateService));
        state = {};
        when(stateService.value).thenReturn(state);
        when(stateService.updateValue(anything())).thenCall((newState) => {
            Object.assign(state, newState);
        });
        vscNotebook = mock<IVSCodeNotebook>();
        onDidChangeNotebookDocument = new EventEmitter<NotebookCellChangedEvent>();
        when(vscNotebook.onDidChangeNotebookDocument).thenReturn(onDidChangeNotebookDocument.event);
        notebookEditorProvider = mock<INotebookEditorProvider>();
        onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
        when(notebookEditorProvider.onDidOpenNotebookEditor).thenReturn(onDidOpenNotebookEditor.event);
        shell = mock<IApplicationShell>();
        browser = mock<IBrowserService>();
        clock = fakeTimers.install();
    });
    async function loadAndActivateExtension() {
        const surveyBanner = new NotebookSurveyBanner(instance(shell), instance(stateFactory), instance(browser));
        survey = new NotebookSurveyDataLogger(
            instance(stateFactory),
            instance(vscNotebook),
            instance(notebookEditorProvider),
            disposables,
            surveyBanner
        );
        await survey.activate();
        await clock.runAllAsync();
    }
    teardown(() => {
        clock.uninstall();
        while (disposables.length) {
            disposables.pop()!.dispose();
        }
    });
    async function performCellOperations(numberOfCellActions: number, numberOfCellRuns: number) {
        for (let i = 0; i < numberOfCellRuns; i += 1) {
            onExecutedCode.fire('');
        }
        for (let i = 0; i < numberOfCellActions; i += 1) {
            onDidChangeNotebookDocument.fire({ type: 'changeCells', changes: [], document: mockDocument });
        }
        await clock.runAllAsync();
    }
    test('No survey displayed when loading extension for first time', async () => {
        await loadAndActivateExtension();

        verify(browser.launch(anything())).never();
    });
    test('Display survey if user performs > 100 cell executions in a notebook', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.yesLabel() as any
        );
        await loadAndActivateExtension();

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 100 actions, survey will not be displayed
        await performCellOperations(0, 100);

        verify(browser.launch(anything())).never();

        // After the 101st action, survey should be displayed.
        await performCellOperations(1, 0);

        verify(browser.launch(anything())).once();

        // Verify survey is disabled.
        verify(stateService.updateValue(deepEqual({ surveyDisabled: true }))).once();
    });
    test('Remind if survey not taken & selected to remind again', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.remindMeLaterLabel() as any
        );
        await loadAndActivateExtension();

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 120 actions, survey will be displayed.
        await performCellOperations(60, 60);
        verify(shell.showInformationMessage(anything(), anything(), anything(), anything())).once();
        verify(browser.launch(anything())).never();

        // Open extension again & confirm prompt is displayed again.
        await loadAndActivateExtension();

        verify(shell.showInformationMessage(anything(), anything(), anything(), anything())).twice();
    });
    test('Do not display again if cancelled', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.noLabel() as any
        );
        await loadAndActivateExtension();

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 120 actions, survey will be displayed.
        await performCellOperations(60, 60);
        verify(shell.showInformationMessage(anything(), anything(), anything(), anything())).once();
        verify(browser.launch(anything())).never();

        // Perform more actions & should not be prompted again.
        reset(shell);
        reset(browser);
        await performCellOperations(60, 60);
        verify(shell.showInformationMessage(anything(), anything(), anything(), anything())).never();
        verify(browser.launch(anything())).never();

        // Open extension again & confirm prompt is displayed again.
        await loadAndActivateExtension();

        verify(shell.showInformationMessage(anything(), anything(), anything(), anything())).never();
        verify(browser.launch(anything())).never();
    });
    test('Display survey if user performs > 100 cell actions in a notebook', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.yesLabel() as any
        );

        await loadAndActivateExtension();

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 100 actions, survey will not be displayed
        await performCellOperations(50, 50);
        verify(browser.launch(anything())).never();

        // After the 101st action, survey should be displayed.
        await performCellOperations(0, 1);
        verify(browser.launch(anything())).once();

        // Verify survey is disabled.
        verify(stateService.updateValue(deepEqual({ surveyDisabled: true }))).once();

        // No subsequent prompts (ever).
        reset(browser);
        await loadAndActivateExtension();
        await clock.runAllAsync();
        await performCellOperations(100, 100);
        verify(browser.launch(anything())).never();
    });
    test('After 5 edits and 6 days of inactivity, display survey', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.yesLabel() as any
        );
        await loadAndActivateExtension();

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 6 actions, survey will not be displayed
        await performCellOperations(4, 2);
        verify(browser.launch(anything())).never();

        // Day 2, & confirm no survey prompts.
        clock.tick(2 * MillisecondsInADay);
        await loadAndActivateExtension();
        await clock.runAllAsync();
        verify(browser.launch(anything())).never();

        // Day 3, & confirm no survey prompts.
        clock.tick(3 * MillisecondsInADay);
        await loadAndActivateExtension();
        await clock.runAllAsync();
        verify(browser.launch(anything())).never();

        // Day 6, & confirm survey prompt is displayed.
        clock.tick(6 * MillisecondsInADay);
        await loadAndActivateExtension();
        await clock.runAllAsync();
        verify(browser.launch(anything())).once();
        verify(stateService.updateValue(deepEqual({ surveyDisabled: true }))).once();

        // No subsequent prompts (ever).
        reset(browser);
        await loadAndActivateExtension();
        await clock.runAllAsync();
        await performCellOperations(100, 100);
        verify(browser.launch(anything())).never();
    });
});
