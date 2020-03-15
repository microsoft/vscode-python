// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';

import { IDataScienceExtraSettings } from '../../client/datascience/types';
import { InputHistory } from './inputHistory';
import { ICellViewModel } from './mainState';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const throttle = require('lodash/throttle') as typeof import('lodash/throttle');

export interface IContentPanelProps {
    baseTheme: string;
    cellVMs: ICellViewModel[];
    history?: InputHistory;
    testMode?: boolean;
    settings?: IDataScienceExtraSettings;
    codeTheme: string;
    submittedText: boolean;
    skipNextScroll: boolean;
    editable: boolean;
    scrollBeyondLastLine: boolean;
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
    public componentWillReceiveProps() {
        this.scrollToBottom();
    }

    public computeIsAtBottom(parent: HTMLDivElement): boolean {
        if (this.bottomRef.current) {
            // if the bottom div is on the screen, the content is at the bottom
            return this.bottomRef.current.offsetTop - parent.offsetTop - 2 < parent.clientHeight + parent.scrollTop;
        }
        return false;
    }

    public render() {
        const className = `${this.props.scrollBeyondLastLine ? 'content-panel-scrollBeyondLastLine' : ''}`;
        return (
            <div id="content-panel-div" ref={this.containerRef} className={className}>
                <div id="cell-table" role="list">
                    {this.renderCells()}
                </div>
                <div id="bottomDiv" ref={this.bottomRef} />
            </div>
        );
    }

    private renderCells = () => {
        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) => {
            return this.props.renderCell(cellVM, index);
        });
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
