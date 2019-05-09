// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as path from 'path';

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
    editCellVM?: ICellViewModel;
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
    monacoTheme?: string;
    tokenizerLoaded?: boolean;
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
export function generateTestState(inputBlockToggled : (id: string) => void, filePath: string = '') : IMainPanelState {
    return {
        cellVMs : generateVMs(inputBlockToggled, filePath),
        editCellVM: createEditableCellVM(1),
        busy: true,
        skipNextScroll : false,
        undoStack : [],
        redoStack : [],
        submittedText: false,
        history: new InputHistory(),
        contentTop: 24,
        rootStyle: darkStyle,
        tokenizerLoaded: true
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
            id: Identifiers.EditCellId,
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
            connection: 'https:\\localhost\\token?=9343p0843084039483084308430984038403840938409384098304983094803948093848034809384'
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
// tslint:disable-next-line: no-multiline-string
                        'text/html': [`
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
