// tslint:disable-next-line: import-name
import React from 'react';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { ICell } from '../../client/datascience/types';
import { CellOutput } from '../history-react/cellOutput';

import '../history-react/cell.css';
import { StyleInjector } from '../react-common/styleInjector';

export interface ICellResultProps {
    baseTheme: string;
    codeTheme: string;
}

interface ICellResultState {
    cell: ICell | undefined;
    status: string;
}

export class CellResult extends React.Component<ICellResultProps, ICellResultState> implements IMessageHandler {
    private postOffice: PostOffice = new PostOffice();

    constructor(props: ICellResultProps) {
        super(props);
        this.state = { cell: undefined, status: '...' };
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);
    }

    public componentWillUnmount() {
        this.postOffice.removeHandler(this);
        this.postOffice.dispose();
    }

    public render() {
        console.log('RENDER ' + this.state.status);
        if (!this.state.cell) return <div />;
        const data = this.state.cell.data;
        if (!data || data.cell_type !== 'code') return <div />;
        const outputClassNames = `cell-output cell-output-${this.props.baseTheme}`;
        const baseTheme = 'vscode-light'; // FIXME
        return (
            <div>
                <StyleInjector
                    expectingDark={baseTheme !== 'vscode-light'}
                    postOffice={this.postOffice} />
                <div className={outputClassNames}>
                    {data.outputs.map(output =>
                        <CellOutput
                            output={output}
                            baseTheme={"vscode-light"}
                            errorBackgroundColor={"orange"}
                            expandImage={() => { }}
                            openLink={() => { }}
                        />)}
                </div>
            </div>
        );
    }

    // tslint:disable-next-line:no-any cyclomatic-complexity
    public handleMessage = (msg: string, payload?: any) => {
        console.log('MESSAGE ' + msg + ' ' + JSON.stringify(payload))
        const cell = payload as ICell;
        switch (msg) {
            case HistoryMessages.StartCell:
                this.setState({ cell: cell, status: 'start' });
                return true;

            case HistoryMessages.FinishCell:
                this.setState({ cell: cell, status: 'finish' });
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
