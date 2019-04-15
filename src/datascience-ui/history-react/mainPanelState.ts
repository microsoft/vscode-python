// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as path from 'path';
import * as uuid from 'uuid/v4';

import { IDataScienceSettings } from '../../client/common/types';
import { CellMatcher } from '../../client/datascience/cellMatcher';
import { concatMultilineString } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { CellState, ICell, ISysInfo } from '../../client/datascience/types';
import { noop } from '../../test/core';
import { ICellViewModel } from './cell';
import { InputHistory } from './inputHistory';

export interface IMainPanelState {
    cellVMs: ICellViewModel[];
    busy: boolean;
    skipNextScroll? : boolean;
    undoStack : ICellViewModel[][];
    redoStack : ICellViewModel[][];
    submittedText: boolean;
    history: InputHistory;
    contentTop: number;
    rootStyle?: string;
    theme?: string;
    forceDark?: boolean;
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

        .cm-header, .cm-strong {font-weight: bold;}
        .cm-em {font-style: italic;}
        .cm-link {text-decoration: underline;}
        .cm-strikethrough {text-decoration: line-through;}

        .cm-s-ipython-theme span.cm-keyword {color: #C586C0; font-style: normal; }
        .cm-s-ipython-theme span.cm-number {color: #b5cea8; font-style: normal; }
        .cm-s-ipython-theme span.cm-def {color: var(--vscode-editor-foreground); }
        .cm-s-ipython-theme span.cm-variable {color: #9CDCFE; font-style: normal; }
        .cm-s-ipython-theme span.cm-punctuation {color: var(--override-foreground, var(--vscode-editor-foreground)); font-style: normal; }
        .cm-s-ipython-theme span.cm-property,
        .cm-s-ipython-theme span.cm-operator {color: #d4d4d4; font-style: normal; }
        .cm-s-ipython-theme span.cm-variable-2 {color: #9CDCFE; font-style: normal; }
        .cm-s-ipython-theme span.cm-variable-3, .cm-s-Default Dark+ .cm-type {color: #9CDCFE; font-style: normal; }
        .cm-s-ipython-theme span.cm-comment {color: #6A9955; font-style: normal; }
        .cm-s-ipython-theme span.cm-string {color: #ce9178; font-style: normal; }
        .cm-s-ipython-theme span.cm-string-2 {color: #ce9178; font-style: normal; }
        .cm-s-ipython-theme span.cm-builtin {color: #DCDCAA; font-style: normal; }
        .cm-s-ipython-theme div.CodeMirror-cursor { border: 1px solid var(--vscode-editor-foreground); background: var(--vscode-editor-foreground); width: 5px; z-index: 100; }
        .cm-s-ipython-theme div.CodeMirror-selected {background: var(--vscode-editor-selectionBackground) !important;}
`;

// This function generates test state when running under a browser instead of inside of
export function generateTestState(inputBlockToggled : (id: string) => void, filePath: string = '') : IMainPanelState {
    return {
        cellVMs : generateVMs(inputBlockToggled, filePath),
        busy: true,
        skipNextScroll : false,
        undoStack : [],
        redoStack : [],
        submittedText: false,
        history: new InputHistory(),
        contentTop: 24,
        rootStyle: darkStyle
    };
}

export function createEditableCellVM(executionCount: number) : ICellViewModel {
    return {
        cell:
        {
            data:
            {
                cell_type: 'code', // We should eventually allow this to change to entering of markdown?
                execution_count: executionCount,
                metadata: {},
                outputs: [],
                source: ''
            },
            id: uuid(),
            file: Identifiers.EmptyFileName,
            line: 0,
            state: CellState.editing
        },
        editable: true,
        inputBlockOpen: true,
        inputBlockShow: true,
        inputBlockText: '',
        inputBlockCollapseNeeded: false,
        inputBlockToggled: noop
    };
}

export function extractInputText(inputCell: ICell, settings: IDataScienceSettings | undefined) : string {
    let source = inputCell.data.cell_type === 'code' ? inputCell.data.source : [];
    const matcher = new CellMatcher(settings);

    // Eliminate the #%% on the front if it has nothing else on the line
    if (source.length > 0) {
        const title = matcher.exec(source[0].trim());
        if (title !== undefined && title.length <= 0) {
            source = source.slice(1);
        }
    }

    return concatMultilineString(source);
}

export function createCellVM(inputCell: ICell, settings: IDataScienceSettings | undefined, inputBlockToggled : (id: string) => void) : ICellViewModel {
    let inputLinesCount = 0;
    const inputText = inputCell.data.cell_type === 'code' ? extractInputText(inputCell, settings) : '';
    if (inputText) {
        inputLinesCount = inputText.split('\n').length;
    }

   return {
       cell: inputCell,
       editable: false,
       inputBlockOpen: true,
       inputBlockShow: true,
       inputBlockText: inputText,
       inputBlockCollapseNeeded: (inputLinesCount > 1),
       inputBlockToggled: inputBlockToggled
   };
}

function generateVMs(inputBlockToggled : (id: string) => void, filePath: string) : ICellViewModel [] {
    const cells = generateCells(filePath);
    return cells.map((cell : ICell) => {
        return createCellVM(cell, undefined, inputBlockToggled);
    });
}

function generateCells(filePath: string) : ICell[] {
    const cellData = generateCellData();
    return cellData.map((data : nbformat.ICodeCell | nbformat.IMarkdownCell | nbformat.IRawCell | ISysInfo, key : number) => {
        return {
            id : key.toString(),
            file : path.join(filePath, 'foo.py'),
            line : 1,
            state: key === cellData.length - 1 ? CellState.executing : CellState.finished,
            data : data
        };
    });
}

//tslint:disable:max-func-body-length
function generateCellData() : (nbformat.ICodeCell | nbformat.IMarkdownCell | nbformat.IRawCell | ISysInfo)[] {

    // Hopefully new entries here can just be copied out of a jupyter notebook (ipynb)
    return [
        {
            // These are special. Sys_info is our own custom cell
            cell_type: 'sys_info',
            path: 'c:\\data\\python.exe',
            version : '3.9.9.9 The Uber Version',
            notebook_version: '(5, 9, 9)',
            source: [],
            metadata: {},
            message: 'You have this python data:',
            connection: 'https:\\localhost'
        },
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
                        'text/plain': [
                            '   num_preg  glucose_conc  diastolic_bp  thickness  insulin   bmi  diab_pred  \\\n',
                            '0         6           148            72         35        0  33.6      0.627   \n',
                            '1         1            85            66         29        0  26.6      0.351   \n',
                            '2         8           183            64          0        0  23.3      0.672   \n',
                            '3         1            89            66         23       94  28.1      0.167   \n',
                            '4         0           137            40         35      168  43.1      2.288   \n',
                            '\n',
                            '   age    skin  diabetes  \n',
                            '0   50  1.3790      True  \n',
                            '1   31  1.1426     False  \n',
                            '2   32  0.0000      True  \n',
                            '3   21  0.9062     False  \n',
                            '4   33  1.3790      True  super long line that should wrap around but it isnt because we didnt put in the correct css super long line that should wrap around but it isnt because we didnt put in the correct css super long line that should wrap around but it isnt because we didnt put in the correct css'
                        ]
                    },
                    execution_count: 4,
                    metadata: {},
                    output_type: 'execute_result'
                }
            ],
            source: [
                '# comment',

                'df',
                'df.head(5)'
            ]
        },
        {
            cell_type: 'markdown',
            metadata: {},
            source: [
                '## Cell 3\n',
                'Here\'s some markdown\n',
                '- A List\n',
                '- Of Items'
            ]
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
            source: [
                'df'
            ]
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
            source: [
                'df'
            ]
        }
    ];
}
