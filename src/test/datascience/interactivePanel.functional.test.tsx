// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as React from 'react';
import { PYTHON_LANGUAGE } from '../../client/common/constants';
import { CellState } from '../../client/datascience/types';
import { InteractiveCellComponent } from '../../datascience-ui/history-react/interactiveCell';
import { IInteractivePanelProps, InteractivePanel } from '../../datascience-ui/history-react/interactivePanel';
import { CursorPos, DebugState, ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { noop } from '../core';
import { mountComponent } from './testHelpers';

// tslint:disable: no-any

suite('DataScience Interactive Panel', () => {
    const noopAny: any = noop;
    let props: IInteractivePanelProps;
    setup(() => {
        props = {
            baseTheme: '',
            busy: false,
            cellVMs: [],
            clickCell: noopAny,
            codeCreated: noopAny,
            codeTheme: '',
            collapseAll: noopAny,
            copyCellCode: noopAny,
            currentExecutionCount: 0,
            debugging: false,
            deleteAllCells: noopAny,
            deleteCell: noopAny,
            dirty: false,
            editCell: noopAny,
            editCellVM: {
                cell: {
                    file: '',
                    id: '',
                    line: 0,
                    state: CellState.finished,
                    data: {
                        cell_type: 'code',
                        execution_count: 0,
                        metadata: {},
                        outputs: [{ data: '', execution_count: 1, metadata: {}, output_type: 'text' }],
                        source: ''
                    }
                },
                cursorPos: CursorPos.Current,
                editable: true,
                focused: false,
                hasBeenRun: true,
                hideOutput: false,
                inputBlockCollapseNeeded: false,
                inputBlockOpen: false,
                inputBlockShow: true,
                inputBlockText: '',
                scrollCount: 0,
                selected: false,
                runningByLine: DebugState.Design
            },
            editorLoaded: noopAny,
            editorUnmounted: noopAny,
            expandAll: noopAny,
            export: noopAny,
            focusInput: noopAny,
            focusPending: 0,
            font: { family: '', size: 1 },
            gatherCell: noopAny,
            gatherCellToScript: noopAny,
            getVariableData: noopAny,
            gotoCell: noopAny,
            interruptKernel: noopAny,
            isAtBottom: false,
            kernel: {
                displayName: '',
                jupyterServerStatus: ServerStatus.Busy,
                localizedUri: '',
                language: PYTHON_LANGUAGE
            },
            knownDark: false,
            linkClick: noopAny,
            loaded: true,
            monacoReady: true,
            openSettings: noopAny,
            redo: noopAny,
            redoStack: [],
            restartKernel: noopAny,
            scroll: noopAny,
            selectKernel: noopAny,
            selectServer: noopAny,
            showDataViewer: noopAny,
            showPlot: noopAny,
            submitInput: noopAny,
            submittedText: noopAny,
            toggleInputBlock: noopAny,
            toggleVariableExplorer: noopAny,
            undo: noopAny,
            undoStack: noopAny,
            unfocus: noopAny,
            widgetFailed: noopAny,
            variableState: {
                currentExecutionCount: 0,
                pageSize: 0,
                sortAscending: true,
                sortColumn: '',
                variables: [],
                visible: true,
                containerHeight: 0,
                gridHeight: 200
            },
            setVariableExplorerHeight: noopAny,
            editorOptions: {},
            settings: { showCellInputCode: true, allowInput: true, extraSettings: { editor: {} } } as any
        };
    });
    test('Input Cell is displayed', () => {
        props.settings!.allowInput = true;

        const wrapper = mountComponent('interactive', <InteractivePanel {...props}></InteractivePanel>);

        assert.equal(wrapper.find(InteractiveCellComponent).length, 1);
    });
    test('Input Cell is not displayed', () => {
        props.settings!.allowInput = false;

        const wrapper = mountComponent('interactive', <InteractivePanel {...props}></InteractivePanel>);

        assert.equal(wrapper.find(InteractiveCellComponent).length, 0);
    });
});
