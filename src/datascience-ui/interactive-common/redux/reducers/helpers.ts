// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { min } from 'lodash';
// tslint:disable-next-line: no-require-imports no-var-requires
const cloneDeep = require('lodash/cloneDeep');

import { ICell, IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { arePathsSame } from '../../../react-common/arePathsSame';
import { detectBaseTheme } from '../../../react-common/themeDetector';
import { ICellViewModel, IMainState } from '../../mainState';
import { CommonReducerArg } from './types';

const StackLimit = 10;

export namespace Helpers {
    export function computeKnownDark(settings?: IDataScienceExtraSettings): boolean {
        const ignore = settings?.ignoreVscodeTheme ? true : false;
        const baseTheme = ignore ? 'vscode-light' : detectBaseTheme();
        return baseTheme !== 'vscode-light';
    }

    export function pushStack(stack: ICellViewModel[][], cells: ICellViewModel[]) {
        // Get the undo stack up to the maximum length
        const slicedUndo = stack.slice(0, min([stack.length, StackLimit]));

        // make a copy of the cells so that further changes don't modify them.
        const copy = cloneDeep(cells);
        return [...slicedUndo, copy];
    }

    export function firstCodeCellAbove(state: IMainState, cellId: string | undefined) {
        const codeCells = state.cellVMs.filter(c => c.cell.data.cell_type === 'code');
        const index = codeCells.findIndex(c => c.cell.id === cellId);
        if (index > 0) {
            return codeCells[index - 1].cell.id;
        }
        return undefined;
    }

    // This function is because the unit test typescript compiler can't handle ICell.metadata
    // tslint:disable-next-line: no-any
    export function asCellViewModel(cvm: any): ICellViewModel {
        return cvm as ICellViewModel;
    }

    export function updateOrAdd<T>(arg: CommonReducerArg<T, ICell>, generateVM: (cell: ICell, mainState: IMainState) => ICellViewModel): IMainState {
        // First compute new execution count.
        const newExecutionCount = arg.payload.data.execution_count
            ? Math.max(arg.prevState.currentExecutionCount, parseInt(arg.payload.data.execution_count.toString(), 10))
            : arg.prevState.currentExecutionCount;

        const index = arg.prevState.cellVMs.findIndex((c: ICellViewModel) => {
            return c.cell.id === arg.payload.id && c.cell.line === arg.payload.line && arePathsSame(c.cell.file, arg.payload.file);
        });
        if (index >= 0) {
            // This means the cell existed already so it was actual executed code.
            // Use its execution count to update our execution count.

            // Have to make a copy of the cell VM array or
            // we won't actually update.
            const newVMs = [...arg.prevState.cellVMs];

            // Live share has been disabled for now, see https://github.com/microsoft/vscode-python/issues/7972
            // Check to see if our code still matches for the cell (in liveshare it might be updated from the other side)
            // if (concatMultilineStringInput(arg.prevState.cellVMs[index].cell.data.source) !== concatMultilineStringInput(cell.data.source)) {

            // Prevent updates to the source, as its possible we have recieved a response for a cell execution
            // and the user has updated the cell text since then.
            const newVM = {
                ...newVMs[index],
                cell: {
                    ...newVMs[index].cell,
                    state: arg.payload.state,
                    data: {
                        ...arg.payload.data,
                        source: newVMs[index].cell.data.source
                    }
                }
            };
            newVMs[index] = asCellViewModel(newVM);

            return {
                ...arg.prevState,
                cellVMs: newVMs,
                currentExecutionCount: newExecutionCount
            };
        } else {
            // This is an entirely new cell (it may have started out as finished)
            const newVM = generateVM(arg.payload, arg.prevState);
            const newVMs = [...arg.prevState.cellVMs, newVM];
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                undoStack: pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
                currentExecutionCount: newExecutionCount
            };
        }
    }
}
