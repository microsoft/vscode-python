// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './contentPanel.css';

import * as React from 'react';
import { noop } from '../../test/core';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { getSettings } from '../react-common/settingsReactSide';
import { Cell, ICellViewModel } from './cell';
import { InputHistory } from './inputHistory';

export interface IContentPanelProps {
    baseTheme: string;
    contentTop: number;
    cellVMs: ICellViewModel[];
    history: InputHistory;
    testMode?: boolean;
    codeTheme: string;
    submittedText: boolean;
    skipNextScroll: boolean;
    saveEditCellRef(ref: Cell | null): void;
    gotoCellCode(index: number): void;
    deleteCell(index: number): void;
    submitInput(code: string): void;
}

export class ContentPanel extends React.Component<IContentPanelProps> {
    private bottom: HTMLDivElement | undefined;
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
        const newContentTop = `${this.props.contentTop.toString()}px solid transparent`;

        const newBorderStyle: React.CSSProperties = {
            borderTop: newContentTop
        };

        return(
            <div id='content-panel-div' style={newBorderStyle}>
                <div id='cell-table'>
                    <div id='cell-table-body'>
                        {this.renderCells()}
                    </div>
                </div>
                <div ref={this.updateBottom}/>
            </div>
        );
    }

    private renderCells = () => {
        const maxOutputSize = getSettings().maxOutputSize;
        const errorBackgroundColor = getSettings().errorBackgroundColor;
        const actualErrorBackgroundColor = errorBackgroundColor ? errorBackgroundColor : '#FFFFFF';
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;
        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) =>
            <ErrorBoundary key={index}>
                <Cell
                    history={cellVM.editable ? this.props.history : undefined}
                    maxTextSize={maxTextSize}
                    autoFocus={document.hasFocus()}
                    testMode={this.props.testMode}
                    cellVM={cellVM}
                    submitNewCode={this.props.submitInput}
                    baseTheme={baseTheme}
                    codeTheme={this.props.codeTheme}
                    showWatermark={!this.props.submittedText}
                    errorBackgroundColor={actualErrorBackgroundColor}
                    ref={(r) => cellVM.editable ? this.props.saveEditCellRef(r) : noop()}
                    gotoCode={() => this.props.gotoCellCode(index)}
                    delete={() => this.props.deleteCell(index)}/>
            </ErrorBoundary>
        );
    }

    private scrollToBottom = () => {
        if (this.bottom && this.bottom.scrollIntoView && !this.props.skipNextScroll && !this.props.testMode) {
            // Delay this until we are about to render. React hasn't setup the size of the bottom element
            // yet so we need to delay. 10ms looks good from a user point of view
            setTimeout(() => {
                if (this.bottom) {
                    this.bottom.scrollIntoView({behavior: 'smooth', block : 'end', inline: 'end'});
                }
            }, 100);
        }
    }

    private updateBottom = (newBottom: HTMLDivElement) => {
        if (newBottom !== this.bottom) {
            this.bottom = newBottom;
        }
    }

}
