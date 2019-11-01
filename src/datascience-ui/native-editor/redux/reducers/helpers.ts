// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { min } from 'lodash';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');

import { ICellViewModel, IMainState } from '../../../interactive-common/mainState';

const StackLimit = 10;

export namespace Helpers {
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
}
