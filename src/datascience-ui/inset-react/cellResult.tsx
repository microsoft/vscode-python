// tslint:disable-next-line: import-name
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
// tslint:disable-next-line: import-name
import React from 'react';
import { HistoryMessages, IHistoryMapping } from '../../client/datascience/history/historyTypes';
import { ICell } from '../../client/datascience/types';
import { CellOutput } from '../history-react/cellOutput';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';

import '../history-react/cell.css';
import { StyleInjector } from '../react-common/styleInjector';

// The WebPanel constructed by the extension should inject a getInitialSettings function into
// the script. This should return a dictionary of key value pairs for settings
// tslint:disable-next-line:no-any
export declare function getInitialSettings(): any;

export interface ICellResultProps {
    baseTheme: string;
    codeTheme: string;
}

interface ICellResultState {
    cell: ICell | undefined;
}

export class CellResult extends React.Component<ICellResultProps, ICellResultState> implements IMessageHandler {
    private postOffice: PostOffice = new PostOffice();

    constructor(props: ICellResultProps) {
        super(props);
        let cell: ICell | undefined;
        if (getInitialSettings) {
            cell = getInitialSettings().cell;
        }
        this.state = { cell: cell };
    }

    public componentWillMount() {
        this.postOffice.addHandler(this);
    }

    public componentWillUnmount() {
        this.postOffice.removeHandler(this);
        this.postOffice.dispose();
    }

    public render() {
        if (!this.state.cell) { return <div />; }

        const data = this.state.cell.data;
        if (!data || data.cell_type !== 'code') { return <div />; }
        const outputClassNames = `cell-output cell-output-${this.props.baseTheme}`;
        const baseTheme = this.props.baseTheme;
        return (
            <div className='inline-result'>
                <StyleInjector
                    expectingDark={baseTheme !== 'vscode-light'}
                    postOffice={this.postOffice} />

                <div className={outputClassNames}>
                    {data.outputs.map(output =>
                        <CellOutput
                            output={output}
                            baseTheme={baseTheme}
                            expandImage={this.showPlot}
                            openLink={this.openLink}
                        />)}
                </div>
            </div>
        );
    }

    // tslint:disable-next-line: no-any
    public handleMessage = (msg: string, payload?: any) => {
        const cell = payload as ICell;
        switch (msg) {
            case HistoryMessages.StartCell:
            case HistoryMessages.FinishCell:
            case HistoryMessages.UpdateCell:
                this.setState({ cell: cell });
                return true;
            default:
                return false;
        }
    }

    private sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }

    private showPlot = (imageHtml: string) => {
        this.sendMessage(HistoryMessages.ShowPlot, imageHtml);
    }

    private openLink = (uri: monacoEditor.Uri) => {
        this.sendMessage(HistoryMessages.OpenLink, uri.toString());
    }

}
