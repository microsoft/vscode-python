import {
  GatherModel,
  IGatherObserver,
  GatherModelEvent,
  GatherEventData,
} from '../model';
import { LabCell } from '../model/cell';

export class ExecutionLogger implements IGatherObserver {
  constructor(gatherModel: GatherModel) {
    gatherModel.addObserver(this);
    this._gatherModel = gatherModel;
  }

  public onModelChange(property: GatherModelEvent, eventData: GatherEventData) {
    if (property == GatherModelEvent.CELL_EXECUTED) {
      let loggableLabCell = (eventData as LabCell).deepCopy();
      this._gatherModel.executionLog.logExecution(loggableLabCell);
    }
  }

  private _gatherModel: GatherModel;
}
