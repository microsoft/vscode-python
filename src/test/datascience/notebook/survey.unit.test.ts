// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
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
import { sleep, waitForCondition } from '../../common';

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
    setup(async () => {
        editor = mock<INotebookEditor>();
        onExecutedCode = new EventEmitter<string>();
        when(editor.onExecutedCode).thenReturn(onExecutedCode.event);
        stateFactory = mock<IPersistentStateFactory>();
        stateService = mock<IPersistentState<NotebookSurveyUsageData>>();
        when(stateFactory.createGlobalPersistentState(anything(), anything())).thenReturn(instance(stateService));
        state = {};
        when(stateService.value).thenReturn(state);
        when(stateService.updateValue(anything())).thenResolve();
        vscNotebook = mock<IVSCodeNotebook>();
        onDidChangeNotebookDocument = new EventEmitter<NotebookCellChangedEvent>();
        when(vscNotebook.onDidChangeNotebookDocument).thenReturn(onDidChangeNotebookDocument.event);
        notebookEditorProvider = mock<INotebookEditorProvider>();
        onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
        when(notebookEditorProvider.onDidOpenNotebookEditor).thenReturn(onDidOpenNotebookEditor.event);
        shell = mock<IApplicationShell>();
        browser = mock<IBrowserService>();
        const surveyBanner = new NotebookSurveyBanner(instance(shell), instance(stateFactory), instance(browser));
        survey = new NotebookSurveyDataLogger(
            instance(stateFactory),
            instance(vscNotebook),
            instance(notebookEditorProvider),
            disposables,
            surveyBanner
        );
    });
    teardown(() => {
        while (disposables.length) {
            disposables.pop()!.dispose();
        }
    });
    test('No survey displayed when loading extension for first time', async () => {
        await survey.activate();
        await sleep(0); // wait for everything to finish.

        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).never();
                return true;
            },
            1_000,
            'Survey should not be displayed'
        );
    });
    function performCellExecutions(numberOfTimes: number) {
        for (let i = 0; i < numberOfTimes; i += 1) {
            onExecutedCode.fire('');
        }
    }
    function performCellActions(numberOfTimes: number) {
        for (let i = 0; i < numberOfTimes; i += 1) {
            onDidChangeNotebookDocument.fire({ type: 'changeCells', changes: [], document: mockDocument });
        }
    }
    test('Display survey if user performs > 100 cell executions in a notebook', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.yesLabel() as any
        );
        await survey.activate();
        await sleep(0); // wait for everything to finish.

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 100 actions, survey will not be displayed
        performCellExecutions(100);
        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).never();
                return true;
            },
            1_000,
            'Survey displayed before 100 actions'
        );

        // After the 101st action, survey should be displayed.
        performCellExecutions(1);
        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).once();
                return true;
            },
            1_000,
            'Survey should have been displayed'
        );

        // Verify survey is disabled.
        await waitForCondition(
            async () => {
                verify(stateService.updateValue(deepEqual({ surveyDisabled: true }))).once();
                return true;
            },
            1_000,
            'Survey should be disabled'
        );
    });
    test('Display survey if user performs > 100 cell actions in a notebook', async () => {
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.yesLabel() as any
        );

        await survey.activate();
        await sleep(0); // wait for everything to finish.

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 100 actions, survey will not be displayed
        performCellActions(100);
        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).never();
                return true;
            },
            1_000,
            'Survey displayed before 100 actions'
        );

        // After the 101st action, survey should be displayed.
        performCellActions(1);
        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).once();
                return true;
            },
            1_000,
            'Survey should have been displayed'
        );

        // Verify survey is disabled.
        await waitForCondition(
            async () => {
                verify(stateService.updateValue(deepEqual({ surveyDisabled: true }))).once();
                return true;
            },
            1_000,
            'Survey should be disabled'
        );
    });
    test('After 5 edits and 6 days of inactivity, display survey', async function () {
        // tslint:disable-next-line: no-invalid-this
        this.timeout(10_000);
        when(shell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
            CommonSurvey.yesLabel() as any
        );
        await survey.activate();
        await sleep(0); // wait for everything to finish.

        // Open nb.
        when(editor.type).thenReturn('native');
        onDidOpenNotebookEditor.fire(instance(editor));

        // Perform 6 actions, survey will not be displayed
        performCellExecutions(6);

        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).never();
                return true;
            },
            1_000,
            'Survey displayed before 100 actions'
        );

        // Day 2
        await survey.activate();
        await sleep(0); // wait for everything to finish.

        // Verify stats have been moved into previous session state and date time has been updated.
        await waitForCondition(async () => (state.lastUsedDateTime || 0) > 0, 1_000, 'DateTime not updated');
        await waitForCondition(async () => state.numberOfCellActionsInCurrentSession === 0, 1_00, 'Not updated');
        await waitForCondition(async () => state.numberOfExecutionsInCurrentSession === 0, 1_00, 'Not updated');
        await waitForCondition(async () => (state.numberOfExecutionsInPreviousSessions || 0) > 0, 1_00, 'Not updated');

        // Lets update date time to 3 days ago.
        state.lastUsedDateTime = new Date().getTime() - MillisecondsInADay;
        await survey.activate();

        // No survey.
        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).never();
                return true;
            },
            1_000,
            'Survey displayed before 100 actions'
        );

        // Lets update date time to 6 days ago.
        state.lastUsedDateTime = new Date().getTime() - 6 * MillisecondsInADay;
        await survey.activate();

        await waitForCondition(
            async () => {
                verify(browser.launch(anything())).once();
                return true;
            },
            1_000,
            'Survey not displayed'
        );

        // Verify survey is disabled.
        await waitForCondition(
            async () => {
                verify(stateService.updateValue(deepEqual({ surveyDisabled: true }))).once();
                return true;
            },
            1_000,
            'Survey should be disabled'
        );
    });
});
