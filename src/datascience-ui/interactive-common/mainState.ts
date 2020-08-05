// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
// tslint:disable-next-line: no-require-imports no-var-requires
const cloneDeep = require('lodash/cloneDeep');
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as path from 'path';

import { DebugProtocol } from 'vscode-debugprotocol';
import { PYTHON_LANGUAGE } from '../../client/common/constants';
import { IDataScienceSettings } from '../../client/common/types';
import { CellMatcher } from '../../client/datascience/cellMatcher';
import { Identifiers } from '../../client/datascience/constants';
import { IEditorPosition } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState, ICell, IDataScienceExtraSettings, IMessageCell } from '../../client/datascience/types';
import { concatMultilineStringInput, splitMultilineString } from '../common';
import { createCodeCell } from '../common/cellFactory';
import { getDefaultSettings } from '../react-common/settingsReactSide';

export enum CursorPos {
    Top,
    Bottom,
    Current
}

// The state we are in for run by line debugging
export enum DebugState {
    Break,
    Design,
    Run
}

export function activeDebugState(state: DebugState): boolean {
    return state === DebugState.Break || state === DebugState.Run;
}

export interface ICellViewModel {
    cell: ICell;
    inputBlockShow: boolean;
    inputBlockOpen: boolean;
    inputBlockText: string;
    inputBlockCollapseNeeded: boolean;
    editable: boolean;
    directInput?: boolean;
    showLineNumbers?: boolean;
    hideOutput?: boolean;
    useQuickEdit?: boolean;
    selected: boolean;
    focused: boolean;
    scrollCount: number;
    cursorPos: CursorPos | IEditorPosition;
    hasBeenRun: boolean;
    runDuringDebug?: boolean;
    codeVersion?: number;
    uiSideError?: string;
    runningByLine: DebugState;
    currentStack?: DebugProtocol.StackFrame[];
    gathering: boolean;
}

export type IMainState = {
    cellVMs: ICellViewModel[];
    editCellVM: ICellViewModel | undefined;
    busy: boolean;
    skipNextScroll?: boolean;
    undoStack: ICellViewModel[][];
    redoStack: ICellViewModel[][];
    submittedText: boolean;
    rootStyle?: string;
    rootCss?: string;
    font: IFont;
    vscodeThemeName?: string;
    baseTheme: string;
    monacoTheme?: string;
    knownDark: boolean;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    currentExecutionCount: number;
    debugging: boolean;
    dirty: boolean;
    isAtBottom: boolean;
    newCellId?: string;
    loadTotal?: number;
    skipDefault?: boolean;
    testMode?: boolean;
    codeTheme: string;
    settings?: IDataScienceExtraSettings;
    focusPending: number;
    monacoReady: boolean;
    loaded: boolean;
    kernel: IServerState;
    isNotebookTrusted: boolean;
    shouldShowTrustMessage: boolean;
};

export type SelectionAndFocusedInfo = {
    selectedCellId?: string;
    selectedCellIndex?: number;
    focusedCellId?: string;
    focusedCellIndex?: number;
};

/**
 * Returns the cell id and index of selected and focused cells.
 */
export function getSelectedAndFocusedInfo(state: { cellVMs: ICellViewModel[] }): SelectionAndFocusedInfo {
    const info: {
        selectedCellId?: string;
        selectedCellIndex?: number;
        focusedCellId?: string;
        focusedCellIndex?: number;
    } = {};
    for (let index = 0; index < state.cellVMs.length; index += 1) {
        const cell = state.cellVMs[index];
        if (cell.selected) {
            info.selectedCellId = cell.cell.id;
            info.selectedCellIndex = index;
        }
        if (cell.focused) {
            info.focusedCellId = cell.cell.id;
            info.focusedCellIndex = index;
        }
        if (info.selectedCellId && info.focusedCellId) {
            break;
        }
    }

    return info;
}

export interface IFont {
    size: number;
    family: string;
}

export interface IServerState {
    jupyterServerStatus: ServerStatus;
    localizedUri: string;
    displayName: string;
    language: string;
}

export enum ServerStatus {
    NotStarted = 'Not Started',
    Busy = 'Busy',
    Idle = 'Idle',
    Dead = 'Dead',
    Starting = 'Starting',
    Restarting = 'Restarting'
}

// tslint:disable-next-line: no-multiline-string
const darkStyle = `
        :root {
            --code-comment-color: #6A9955;
            --code-numeric-color: #b5cea8;
            --code-string-color: #ce9178;
            --code-variable-color: #9CDCFE;
            --code-type-color: #4EC9B0;
            --code-font-family: Consolas, 'Courier New', monospace;
            --code-font-size: 14px;
        }
`;

// This function generates test state when running under a browser instead of inside of
export function generateTestState(filePath: string = '', editable: boolean = false): IMainState {
    const defaultSettings = getDefaultSettings();

    return {
        cellVMs: generateTestVMs(filePath, editable),
        editCellVM: createEditableCellVM(1),
        busy: false,
        skipNextScroll: false,
        undoStack: [],
        redoStack: [],
        submittedText: false,
        rootStyle: darkStyle,
        editorOptions: {},
        currentExecutionCount: 0,
        knownDark: false,
        baseTheme: 'vscode-light',
        debugging: false,
        isAtBottom: false,
        font: {
            size: 14,
            family: "Consolas, 'Courier New', monospace"
        },
        dirty: false,
        codeTheme: 'Foo',
        settings: defaultSettings,
        focusPending: 0,
        monacoReady: true,
        loaded: false,
        testMode: true,
        kernel: {
            localizedUri: 'No Kernel',
            displayName: 'Python',
            jupyterServerStatus: ServerStatus.NotStarted,
            language: PYTHON_LANGUAGE
        },
        isNotebookTrusted: true,
        shouldShowTrustMessage: true
    };
}

export function createEmptyCell(id: string | undefined, executionCount: number | null): ICell {
    const emptyCodeCell = createCodeCell();
    emptyCodeCell.execution_count = executionCount ?? null;
    return {
        data: emptyCodeCell,
        id: id ? id : Identifiers.EditCellId,
        file: Identifiers.EmptyFileName,
        line: 0,
        state: CellState.finished
    };
}

export function createEditableCellVM(executionCount: number): ICellViewModel {
    return {
        cell: createEmptyCell(Identifiers.EditCellId, executionCount),
        editable: true,
        inputBlockOpen: true,
        inputBlockShow: true,
        inputBlockText: '',
        inputBlockCollapseNeeded: false,
        selected: false,
        focused: false,
        cursorPos: CursorPos.Current,
        hasBeenRun: false,
        scrollCount: 0,
        runningByLine: DebugState.Design,
        gathering: false
    };
}

export function extractInputText(inputCellVM: ICellViewModel, settings: IDataScienceSettings | undefined): string {
    const inputCell = inputCellVM.cell;
    let source: string[] = [];
    if (inputCell.data.source) {
        source = splitMultilineString(cloneDeep(inputCell.data.source));
    }
    const matcher = new CellMatcher(settings);

    // Eliminate the #%% on the front if it has nothing else on the line
    if (source.length > 0) {
        const title = matcher.exec(source[0].trim());
        if (title !== undefined && title.length <= 0) {
            source.splice(0, 1);
        }
        // Eliminate the lines to hide if we're debugging
        if (inputCell.extraLines) {
            inputCell.extraLines.forEach((i) => source.splice(i, 1));
            inputCell.extraLines = undefined;
        }
    }

    // Eliminate breakpoint on the front if we're debugging and breakpoints are expected to be prefixed
    if (source.length > 0 && inputCellVM.runDuringDebug && (!settings || settings.stopOnFirstLineWhileDebugging)) {
        if (source[0].trim() === 'breakpoint()') {
            source.splice(0, 1);
        }
    }

    return concatMultilineStringInput(source);
}

export function createCellVM(
    inputCell: ICell,
    settings: IDataScienceSettings | undefined,
    editable: boolean,
    runDuringDebug: boolean
): ICellViewModel {
    const vm = {
        cell: inputCell,
        editable,
        inputBlockOpen: true,
        inputBlockShow: true,
        inputBlockText: '',
        inputBlockCollapseNeeded: false,
        selected: false,
        focused: false,
        cursorPos: CursorPos.Current,
        hasBeenRun: false,
        scrollCount: 0,
        runDuringDebug,
        runningByLine: DebugState.Design,
        gathering: false
    };

    // Update the input text
    let inputLinesCount = 0;
    // If the cell is markdown, initialize inputBlockText with the mardown value.
    // `inputBlockText` will be used to maintain diffs of editor changes. So whether its markdown or code, we need to generate it.
    const inputText =
        inputCell.data.cell_type === 'code'
            ? extractInputText(vm, settings)
            : inputCell.data.cell_type === 'markdown'
            ? concatMultilineStringInput(vm.cell.data.source)
            : '';
    if (inputText) {
        inputLinesCount = inputText.split('\n').length;
    }

    vm.inputBlockText = inputText;
    vm.inputBlockCollapseNeeded = inputLinesCount > 1;

    return vm;
}

function generateTestVMs(filePath: string, editable: boolean): ICellViewModel[] {
    const cells = generateTestCells(filePath, 10);
    return cells.map((cell: ICell) => {
        const vm = createCellVM(cell, undefined, editable, false);
        vm.useQuickEdit = false;
        vm.hasBeenRun = true;
        return vm;
    });
}

export function generateTestCells(filePath: string, repetitions: number): ICell[] {
    // Dupe a bunch times for perf reasons
    let cellData: (nbformat.ICodeCell | nbformat.IMarkdownCell | nbformat.IRawCell | IMessageCell)[] = [];
    for (let i = 0; i < repetitions; i += 1) {
        cellData = [...cellData, ...generateCellData()];
    }
    return cellData.map(
        (data: nbformat.ICodeCell | nbformat.IMarkdownCell | nbformat.IRawCell | IMessageCell, key: number) => {
            return {
                id: key.toString(),
                file: path.join(filePath, 'foo.py').toLowerCase(),
                line: 1,
                state: key === cellData.length - 1 ? CellState.executing : CellState.finished,
                type: key === 3 ? 'preview' : 'execute',
                data: data
            };
        }
    );
}

//tslint:disable:max-func-body-length
function generateCellData(): (nbformat.ICodeCell | nbformat.IMarkdownCell | nbformat.IRawCell | IMessageCell)[] {
    // Hopefully new entries here can just be copied out of a jupyter notebook (ipynb)
    return [
        {
            cell_type: 'code',
            execution_count: 467,
            metadata: {
                slideshow: {
                    slide_type: '-'
                }
            },
            outputs: [
                {
                    data: {
                        // tslint:disable-next-line: no-multiline-string
                        'text/html': [
                            `
                            <div style="
                            overflow: auto;
                        ">
                        <style scoped="">
                            .dataframe tbody tr th:only-of-type {
                                vertical-align: middle;
                            }
                            .dataframe tbody tr th {
                                vertical-align: top;
                            }
                            .dataframe thead th {
                                text-align: right;
                            }
                        </style>
                        <table border="1" class="dataframe">
                          <thead>
                            <tr style="text-align: right;">
                              <th></th>
                              <th>0</th>
                              <th>1</th>
                              <th>2</th>
                              <th>3</th>
                              <th>4</th>
                              <th>5</th>
                              <th>6</th>
                              <th>7</th>
                              <th>8</th>
                              <th>9</th>
                              <th>...</th>
                              <th>2990</th>
                              <th>2991</th>
                              <th>2992</th>
                              <th>2993</th>
                              <th>2994</th>
                              <th>2995</th>
                              <th>2996</th>
                              <th>2997</th>
                              <th>2998</th>
                              <th>2999</th>
                            </tr>
                            <tr>
                              <th>idx</th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <th>2007-01-31</th>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>...</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                              <td>37.060604</td>
                            </tr>
                            <tr>
                              <th>2007-02-28</th>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>...</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                              <td>20.603407</td>
                            </tr>
                            <tr>
                              <th>2007-03-31</th>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>...</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                              <td>6.142031</td>
                            </tr>
                            <tr>
                              <th>2007-04-30</th>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>...</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                              <td>6.931635</td>
                            </tr>
                            <tr>
                              <th>2007-05-31</th>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>...</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                              <td>52.642243</td>
                            </tr>
                          </tbody>
                        </table>
                        <p>5 rows × 3000 columns</p>
                        </div>`
                        ]
                    },
                    execution_count: 4,
                    metadata: {},
                    output_type: 'execute_result'
                }
            ],
            source: [
                'myvar = """ # Lorem Ipsum\n',
                '\n',
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n',
                'Nullam eget varius ligula, eget fermentum mauris.\n',
                'Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.\n',
                'Nunc quis orci ante. Vivamus vel blandit velit.\n","Sed mattis dui diam, et blandit augue mattis vestibulum.\n',
                'Suspendisse ornare interdum velit. Suspendisse potenti.\n',
                'Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.\n',
                '"""'
            ]
        },
        {
            cell_type: 'markdown',
            metadata: {},
            source: ['## Cell 3\n', "Here's some markdown\n", '- A List\n', '- Of Items']
        },
        {
            cell_type: 'code',
            execution_count: 1,
            metadata: {},
            outputs: [
                {
                    ename: 'NameError',
                    evalue: 'name "df" is not defined',
                    output_type: 'error',
                    traceback: [
                        '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m                                 Traceback (most recent call last)',
                        '\u001b[1;32m<ipython-input-1-00cf07b74dcd>\u001b[0m in \u001b[0;36m<module>\u001b[1;34m()\u001b[0m\n\u001b[1;32m----> 1\u001b[1;33m \u001b[0mdf\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m: name "df" is not defined'
                    ]
                }
            ],
            source: ['df']
        },
        {
            cell_type: 'code',
            execution_count: 1,
            metadata: {},
            outputs: [
                {
                    ename: 'NameError',
                    evalue: 'name "df" is not defined',
                    output_type: 'error',
                    traceback: [
                        '\u001b[1;31m---------------------------------------------------------------------------\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m                                 Traceback (most recent call last)',
                        '\u001b[1;32m<ipython-input-1-00cf07b74dcd>\u001b[0m in \u001b[0;36m<module>\u001b[1;34m()\u001b[0m\n\u001b[1;32m----> 1\u001b[1;33m \u001b[0mdf\u001b[0m\u001b[1;33m\u001b[0m\u001b[0m\n\u001b[0m',
                        '\u001b[1;31mNameError\u001b[0m: name "df" is not defined'
                    ]
                }
            ],
            source: ['df']
        }
    ];
}
