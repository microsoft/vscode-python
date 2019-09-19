import { DataflowAnalyzer } from '@msrvida/python-program-analysis';
import { JupyterCell as ICell, LabCell } from '@msrvida/python-program-analysis/lib/cell';
import { CellSlice } from '@msrvida/python-program-analysis/lib/cellslice';
import { ExecutionLogSlicer } from '@msrvida/python-program-analysis/lib/log-slicer';

import { inject, injectable } from 'inversify';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
// tslint:disable-next-line: no-duplicate-imports
import { Common } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { CellMatcher } from '../cellMatcher';
import { concatMultilineString } from '../common';
import { CellState, ICell as IVscCell, IGatherExecution, INotebookExecutionLogger, internalUseCellKey } from '../types';

/**
 * An adapter class to wrap the code gathering functionality from [microsoft/python-program-analysis](https://www.npmjs.com/package/@msrvida/python-program-analysis).
 */
@injectable()
export class GatherExecution implements IGatherExecution, INotebookExecutionLogger {
    private _executionSlicer: ExecutionLogSlicer;
    private dataflowAnalyzer: DataflowAnalyzer;
    private _enabled: boolean;

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(ICommandManager) private commandManager: ICommandManager
    ) {
        this._enabled = this.configService.getSettings().datascience.enableGather ? true : false;

        const rules = this.configService.getSettings().datascience.gatherRules;
        this.dataflowAnalyzer = new DataflowAnalyzer(rules);
        this._executionSlicer = new ExecutionLogSlicer(this.dataflowAnalyzer);

        if (this.enabled) {
            this.disposables.push(this.configService.getSettings().onDidChange(e => this.updateEnableGather(e)));
        }

        traceInfo('Gathering tools have been activated');
    }

    public async preExecute(_vscCell: IVscCell, _silent: boolean): Promise<void> {
        // This function is just implemented here for compliance with the INotebookExecutionLogger interface
        noop();
    }

    public async postExecute(vscCell: IVscCell, _silent: boolean): Promise<void> {
        if (this.enabled) {
            // Don't log if vscCell.data.source is an empty string. Original Jupyter extension also does this.
            if (vscCell.data.source !== '') {
                // First make a copy of this cell, as we are going to modify it
                const cloneCell: IVscCell = cloneDeep(vscCell);

                // Strip first line marker. We can't do this at JupyterServer.executeCodeObservable because it messes up hashing
                const cellMatcher = new CellMatcher(this.configService.getSettings().datascience);
                cloneCell.data.source = cellMatcher.stripFirstMarker(concatMultilineString(vscCell.data.source));

                // Convert IVscCell to IGatherCell
                const cell = convertVscToGatherCell(cloneCell) as LabCell;

                // Call internal logging method
                if (!cloneCell.data.source.startsWith(internalUseCellKey)) {
                    this._executionSlicer.logExecution(cell);
                }
            }
        }
    }

    /**
     * For a given code cell, returns a string representing a program containing all the code it depends on.
     */
    public gatherCode(vscCell: IVscCell): string {
        // sliceAllExecutions does a lookup based on executionEventId
        const cell = convertVscToGatherCell(vscCell);
        if (cell === undefined) {
            return '';
        }
        // Call internal slice method
        const slices = this._executionSlicer.sliceAllExecutions(cell);
        const program = slices[0].cellSlices.reduce(concat, '');

        // Add a comment at the top of the file explaining what gather does
        const descriptor = '# This file contains the minimal amount of code required to produce the code cell you gathered.\n';
        return descriptor.concat(program);
    }

    public get executionSlicer() {
        return this._executionSlicer;
    }

    public get enabled() {
        return this._enabled;
    }

    public set enabled(enabled: boolean) {
        this._enabled = enabled;
    }

    public async updateEnableGather(_e: void) {
        if (this.enabled !== this.configService.getSettings().datascience.enableGather) {
            this.enabled = this.configService.getSettings().datascience.enableGather ? true : false;
            const item = await this.applicationShell.showInformationMessage(localize.DataScience.reloadRequired(), Common.reload());
            if (!item) {
                return;
            }
            if (item === 'Reload') {
                this.commandManager.executeCommand('workbench.action.reloadWindow');
            }
        }
    }
}

/**
 * Accumulator to concatenate cell slices for a sliced program, preserving cell structures.
 */
function concat(existingText: string, newText: CellSlice) {
    // Include our cell marker so that cell slices are preserved
    return `${existingText}#%%\n${newText.textSliceLines}\n\n`;
}

/**
 * This is called to convert VS Code ICells to Gather ICells for logging.
 * @param cell A cell object conforming to the VS Code cell interface
 */
function convertVscToGatherCell(cell: IVscCell): ICell | undefined {
    // This should always be true since we only want to log code cells. Putting this here so types match for outputs property
    if (cell.data.cell_type === 'code') {
        const result: ICell = {
            // tslint:disable-next-line no-unnecessary-local-variable
            id: cell.id,
            gathered: false,
            dirty: false,
            text: cell.data.source,

            // This may need to change for native notebook support since in the original Gather code this refers to the number of times that this same cell was executed
            executionCount: cell.data.execution_count,
            executionEventId: cell.id, // This is unique for now, so feed it in

            // This may need to change for native notebook support, since this is intended to persist in the metadata for a notebook that is saved and then re-loaded
            persistentId: cell.id,
            outputs: cell.data.outputs,
            hasError: cell.state === CellState.error,
            is_cell: true
            // tslint:disable-next-line: no-any
        } as any;
        return result;
    }
}
