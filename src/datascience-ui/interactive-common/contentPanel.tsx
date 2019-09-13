// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';

import { Identifiers } from '../../client/datascience/constants';
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
    history: InputHistory;
    testMode?: boolean;
    codeTheme: string;
    submittedText: boolean;
    skipNextScroll: boolean;
    editable: boolean;
    renderCell(cellVM: ICellViewModel, index: number, containerRef?: React.RefObject<HTMLDivElement>): JSX.Element | null;
    focusCell(cellVM: ICellViewModel, focusCode: boolean): void;
    onRenderCompleted?(cells: (HTMLDivElement | null)[]): void;
    scrollToBottom(div: HTMLDivElement): void;
}

export class ContentPanel extends React.Component<IContentPanelProps> {
    private bottomRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private containerRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private cellContainerRefs: Map<string, React.RefObject<HTMLDivElement>> = new Map<string, React.RefObject<HTMLDivElement>>();
    private throttledScrollIntoView = throttle(this.scrollIntoView.bind(this), 100);
    constructor(prop: IContentPanelProps) {
        super(prop);
    }

    public componentDidMount() {
        this.scrollToBottom();

        // Indicate we completed our first render
        if (this.props.onRenderCompleted && this.cellContainerRefs.values) {
            const values = Array.from(this.cellContainerRefs.values()).map(c => c.current);
            this.props.onRenderCompleted(values);
        }
    }

    public componentDidUpdate() {
        this.scrollToBottom();
    }

    public render() {
        return(
            <div id='content-panel-div' ref={this.containerRef}>
                <div id='cell-table'>
                    <div id='cell-table-body' role='list'>
                        {this.renderCells()}
                        {this.renderEdit()}
                    </div>
                </div>
                <div ref={this.bottomRef}/>
            </div>
        );
    }

    public scrollToCell(cellId: string) {
        const ref = this.cellContainerRefs.get(cellId);
        if (ref && ref.current) {
            ref.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            ref.current.classList.add('flash');
            setTimeout(() => {
                if (ref.current) {
                    ref.current.classList.remove('flash');
                }
            }, 1000);
        }
    }

    public focusCell(cellId: string, focusCode: boolean) {
        const ref = this.cellContainerRefs.get(cellId);
        const vm = this.props.cellVMs.find(c => c.cell.id === cellId) || (cellId === Identifiers.EditCellId) ? this.props.newCellVM : undefined;
        if (ref && ref.current) {
            ref.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            if (vm) {
                this.props.focusCell(vm, focusCode);
            }
        }
    }

    private renderCells = () => {
        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) => {
            let ref: React.RefObject<HTMLDivElement> | undefined;
            if (!this.cellContainerRefs.has(cellVM.cell.id)) {
                ref = React.createRef<HTMLDivElement>();
                this.cellContainerRefs.set(cellVM.cell.id, ref);
            }
            this.props.renderCell(cellVM, index, ref!);
        });
    }

    private renderEdit = () => {
        if (this.props.editable && this.props.newCellVM) {
            return this.props.renderCell(this.props.newCellVM, 0, undefined);
        } else {
            return null;
        }
    }

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
