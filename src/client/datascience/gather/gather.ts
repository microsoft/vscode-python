import { CellSlice, DataflowAnalyzer, ExecutionLogSlicer } from '@msrvida/python-program-analysis';
import { Cell as IGatherCell } from '@msrvida/python-program-analysis/dist/es5/cell';

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
// tslint:disable-next-line: no-duplicate-imports
import { Common } from '../../common/utils/localize';
import { Identifiers } from '../constants';
import { CellState, ICell as IVscCell, IGatherExecution } from '../types';

/**
 * An adapter class to wrap the code gathering functionality from [microsoft/python-program-analysis](https://www.npmjs.com/package/@msrvida/python-program-analysis).
 */
@injectable()
export class GatherExecution implements IGatherExecution {
    private _executionSlicer: ExecutionLogSlicer<IGatherCell>;
    private dataflowAnalyzer: DataflowAnalyzer;
    private _enabled: boolean;

    constructor(
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(ICommandManager) private commandManager: ICommandManager
    ) {
        this._enabled = this.configService.getSettings().datascience.enableGather ? true : false;

        this.dataflowAnalyzer = new DataflowAnalyzer();
        this._executionSlicer = new ExecutionLogSlicer(this.dataflowAnalyzer);

        if (this._enabled) {
            this.disposables.push(this.configService.getSettings().onDidChange(e => this.updateEnableGather(e)));
        }

        traceInfo('Gathering tools have been activated');
    }
    public logExecution(vscCell: IVscCell): void {
        const gatherCell = convertVscToGatherCell(vscCell);

        if (gatherCell) {
            this._executionSlicer.logExecution(gatherCell);
        }
    }

    public async resetLog(): Promise<void> {
        this._executionSlicer.reset();
    }

    /**
     * For a given code cell, returns a string representing a program containing all the code it depends on.
     */
    public gatherCode(vscCell: IVscCell): string {
        const gatherCell = convertVscToGatherCell(vscCell);
        if (!gatherCell) {
            return '';
        }

        // Get the default cell marker as we need to replace #%% with it.
        const defaultCellMarker =
            this.configService.getSettings().datascience.defaultCellMarker || Identifiers.DefaultCodeCellMarker;

        // Call internal slice method
        const slices = this._executionSlicer.sliceAllExecutions(gatherCell.persistentId);
        const program =
            slices.length > 0 ? slices[0].cellSlices.reduce(concat, '').replace(/#%%/g, defaultCellMarker) : '';

        // Add a comment at the top of the file explaining what gather does
        const descriptor = localize.DataScience.gatheredScriptDescription();
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
            const item = await this.applicationShell.showInformationMessage(
                localize.DataScience.reloadRequired(),
                Common.reload()
            );
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
function concat(existingText: string, newText: CellSlice): string {
    // Include our cell marker so that cell slices are preserved
    return `${existingText}#%%\n${newText.textSliceLines}\n\n`;
}

/**
 * This is called to convert VS Code ICells to Gather ICells for logging.
 * @param cell A cell object conforming to the VS Code cell interface
 */
function convertVscToGatherCell(cell: IVscCell): IGatherCell | undefined {
    // This should always be true since we only want to log code cells. Putting this here so types match for outputs property
    if (cell.data.cell_type === 'code') {
        const result: IGatherCell = {
            // tslint:disable-next-line no-unnecessary-local-variable
            text: cell.data.source,

            // This may need to change for native notebook support since in the original Gather code this refers to the number of times that this same cell was executed
            executionCount: cell.data.execution_count,
            executionEventId: cell.id, // This is unique for now, so feed it in

            // This may need to change for native notebook support, since this is intended to persist in the metadata for a notebook that is saved and then re-loaded
            persistentId: cell.id,
            hasError: cell.state === CellState.error
            // tslint:disable-next-line: no-any
        } as any;
        return result;
    }
}
