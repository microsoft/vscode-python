// tslint:disable-next-line: import-name
import React from 'react';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IMessageHandler } from '../react-common/postOffice';

export interface ICellResultProps {
    baseTheme: string;
    codeTheme: string;
}

export class CellResult extends React.Component<ICellResultProps> implements IMessageHandler {
    public render() {
        return <div></div>;
    }

    // tslint:disable-next-line:no-any cyclomatic-complexity
    public handleMessage = (msg: string, _payload?: any) => {
        switch (msg) {
            case HistoryMessages.StartCell:
                // this.startCell(payload);
                return true;

            case HistoryMessages.FinishCell:
                // this.finishCell(payload);
                return true;

            case HistoryMessages.UpdateCell:
                // this.updateCell(payload);
                return true;

            case HistoryMessages.GetAllCells:
                // this.getAllCells();
                return true;

            case HistoryMessages.ExpandAll:
                // this.expandAllSilent();
                return true;

            case HistoryMessages.CollapseAll:
                // this.collapseAllSilent();
                return true;

            case HistoryMessages.DeleteAllCells:
                // this.clearAllSilent();
                return true;

            default:
                break;
        }

        return false;
    }

}
