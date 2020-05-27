// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import { noop } from '../../client/common/utils/misc';
import { traceCellResults } from '../../client/datascience/common';
import { ICell, INotebookExecutionLogger } from '../../client/datascience/types';
import { traceInfo } from '../../client/logging';
import { concatMultilineStringInput } from '../../datascience-ui/common';

@injectable()
export class TestExecutionLogger implements INotebookExecutionLogger {
    public dispose() {
        noop();
    }
    public preExecute(cell: ICell, _silent: boolean): Promise<void> {
        traceInfo(`Cell Execution for ${cell.id} : \n${concatMultilineStringInput(cell.data.source)}\n`);
        return Promise.resolve();
    }
    public postExecute(cell: ICell, _silent: boolean): Promise<void> {
        traceCellResults(`Cell Execution complete for ${cell.id}\n`, [cell]);
        return Promise.resolve();
    }
    public onKernelRestarted(): void {
        // Can ignore this.
    }
}
