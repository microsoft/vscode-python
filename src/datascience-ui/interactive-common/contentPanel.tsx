// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';

import { InputHistory } from './inputHistory';
import { ICellViewModel } from './mainState';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const throttle = require('lodash/throttle') as typeof import('lodash/throttle');

export interface IContentPanelProps {
    baseTheme: string;
    cellVMs: ICellViewModel[];
    newCellVM?: ICellViewModel;
    history?: InputHistory;
    testMode?: boolean;
    codeTheme: string;
    submittedText: boolean;
    skipNextScroll: boolean;
    editable: boolean;
    renderCell(cellVM: ICellViewModel, index: number): JSX.Element | null;
    scrollToBottom(div: HTMLDivElement): void;
}

export class ContentPanel extends React.Component<IContentPanelProps> {
    private bottomRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private containerRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private throttledScrollIntoView = throttle(this.scrollIntoView.bind(this), 100);
    constructor(prop: IContentPanelProps) {
        super(prop);
    }

    public componentDidMount() {
        this.scrollToBottom();
    }

    public componentDidUpdate() {
        this.scrollToBottom();
    }

    public render() {
        return (
            <div id="content-panel-div" ref={this.containerRef}>
                <div id="cell-table">
                    <div id="cell-table-body" role="list">
                        {this.renderCells()}
                        {this.renderEdit()}
                    </div>
                </div>
                <div ref={this.bottomRef} />
            </div>
        );
    }

    private renderCells = () => {
        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) => {
            return this.props.renderCell(cellVM, index);
        });
    };

    private renderEdit = () => {
        if (this.props.editable && this.props.newCellVM) {
            return this.props.renderCell(this.props.newCellVM, 0);
        } else {
            return null;
        }
    };

    private scrollIntoView() {
        if (this.bottomRef.current && this.props.scrollToBottom) {
            this.props.scrollToBottom(this.bottomRef.current);
        }
    }

    private scrollToBottom() {
        if (this.bottomRef.current && !this.props.skipNextScroll && !this.props.testMode && this.containerRef.current) {
            // Make sure to debounce this so it doesn't take up too much time.
            this.throttledScrollIntoView();
        }
    }
}
