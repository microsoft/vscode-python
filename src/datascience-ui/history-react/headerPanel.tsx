// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './headerPanel.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { getSettings } from '../react-common/settingsReactSide';
import { CellButton } from './cellButton';
import { Image, ImageName } from './image';
import { MenuBar } from './menuBar';
import { VariableExplorer } from './variableExplorer';

export interface IHeaderPanelProps {
    baseTheme: string;
    busy: boolean;
    canCollapseAll: boolean;
    canExpandAll: boolean;
    canExport: boolean;
    canUndo: boolean;
    canRedo: boolean;
    skipDefault?: boolean;
    testMode?: boolean;
    variableExplorerRef: React.RefObject<VariableExplorer>;
    addMarkdown(): void;
    collapseAll(): void;
    expandAll(): void;
    export(): void;
    restartKernel(): void;
    interruptKernel(): void;
    undo(): void;
    redo(): void;
    clearAll(): void;
    showDataExplorer(): void;
    refreshVariables(): void;
    onHeightChange(newHeight: number): void;
}

export class HeaderPanel extends React.Component<IHeaderPanelProps> {
    constructor(prop: IHeaderPanelProps) {
        super(prop);
    }

    public render() {
        const progressBar = this.props.busy && !this.props.testMode ? <Progress /> : undefined;
        return(
            <div id='header-panel-div'>
                <MenuBar baseTheme={this.props.baseTheme}>
                    {this.renderExtraButtons()}
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.collapseAll} disabled={!this.props.canCollapseAll} tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.CollapseAll}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.expandAll} disabled={!this.props.canExpandAll} tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.ExpandAll}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.export} disabled={!this.props.canExport} tooltip={getLocString('DataScience.export', 'Export as Jupyter Notebook')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.SaveAs}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.restartKernel} tooltip={getLocString('DataScience.restartServer', 'Restart iPython Kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Restart}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.interruptKernel} tooltip={getLocString('DataScience.interruptKernel', 'Interrupt iPython Kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Interrupt}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.undo} disabled={!this.props.canUndo} tooltip={getLocString('DataScience.undo', 'Undo')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Undo}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.redo} disabled={!this.props.canRedo} tooltip={getLocString('DataScience.redo', 'Redo')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Redo}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.props.clearAll} tooltip={getLocString('DataScience.clearAll', 'Remove All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Cancel}/>
                    </CellButton>
                    {this.renderDataFrameTestButton()}
                </MenuBar>
                {progressBar}
                <VariableExplorer baseTheme={this.props.baseTheme} refreshVariables={this.props.refreshVariables} onHeightChange={this.onVariableHeightChange} ref={this.props.variableExplorerRef} />
            </div>
        );
    }

    private onVariableHeightChange = () => {
        const divElement = ReactDOM.findDOMNode(this) as HTMLDivElement;

        if (divElement) {
            const computeHeight = divElement.offsetHeight;
            this.props.onHeightChange(computeHeight);
        }
    }

    private renderExtraButtons = () => {
        if (!this.props.skipDefault) {
            const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;
            return <CellButton baseTheme={baseTheme} onClick={this.props.addMarkdown} tooltip='Add Markdown Test'>M</CellButton>;
        }

        return null;
    }

    private renderDataFrameTestButton() {
        if (getSettings && getSettings().showJupyterVariableExplorer) {
            return (
                <CellButton baseTheme={'vscode-light'} onClick={this.props.showDataExplorer} tooltip={'Show data explorer for \'df\' variable'}>
                    D
                </CellButton>
            );
        }
        return null;
    }
}
