// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState } from '../../../../client/datascience/types';
import { IMainState } from '../../mainState';
import { createPostableAction } from '../postOffice';
import { CommonReducerArg } from './types';

export namespace Test {
    export function nextUpdate<T>(arg: CommonReducerArg<T, IMainState>): IMainState {
        if (arg.prevState.testMode) {
            const currentFinished = arg.prevState.cellVMs.filter(c => c.cell.state === CellState.finished || c.cell.state === CellState.error).map(c => c.cell.id);
            const previousFinished = arg.payload.cellVMs.filter(c => c.cell.state === CellState.finished || c.cell.state === CellState.error).map(c => c.cell.id);
            if (currentFinished.length > previousFinished.length) {
                const diff = currentFinished.filter(r => previousFinished.indexOf(r) < 0);
                // Send async so happens after the render is actually finished.
                setTimeout(() => arg.queueAction(createPostableAction(InteractiveWindowMessages.RenderComplete, { ids: diff })));
            }
        }

        return arg.prevState;
    }

}
