import { IExecutionLogger } from '../../types';
import { GatherEventData, GatherModel, GatherModelEvent, IGatherObserver } from '../model';
import { LabCell } from '../model/cell';

export class ExecutionLogger implements IGatherObserver, IExecutionLogger {
    private _gatherModel: GatherModel;
    constructor(gatherModel: GatherModel) {
        gatherModel.addObserver(this);
        this._gatherModel = gatherModel;
    }

    public onModelChange(property: GatherModelEvent, eventData: GatherEventData) {
        if (property == GatherModelEvent.CELL_EXECUTED) {
            const loggableLabCell = (eventData as LabCell).deepCopy();
            this._gatherModel.executionLogSlicer.logExecution(loggableLabCell);
        }
    }

}
