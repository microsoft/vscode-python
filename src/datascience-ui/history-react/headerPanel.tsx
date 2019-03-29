// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './headerPanel.css';

import * as React from 'react';

import { getLocString } from '../react-common/locReactSide';
import { CellButton } from './cellButton';
import { Image, ImageName } from './image';
import { MenuBar } from './menuBar';

export interface IHeaderPanelProps {
    baseTheme: string;
    canCollapseAll: boolean;
    canExpandAll: boolean;
    canExport: boolean;
    canUndo: boolean;
    canRedo: boolean;
    collapseAll(): void;
    expandAll(): void;
    export(): void;
    restartKernel(): void;
    interruptKernel(): void;
    undo(): void;
    redo(): void;
    clearAll(): void;
}

interface IHeaderPanelState {
}

export class HeaderPanel extends React.Component<IHeaderPanelProps, IHeaderPanelState> {
    constructor(prop: IHeaderPanelProps) {
        super(prop);
        //this.state = { open: false,
                        //gridColumns: columns,
                        //gridRows: [],
                        //gridHeight: 200};
    }

    //private renderExtraButtons = () => {
        //if (!this.props.skipDefault) {
            //const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;
            //return <CellButton baseTheme={baseTheme} onClick={this.addMarkdown} tooltip='Add Markdown Test'>M</CellButton>;
        //}

        //return null;
    //}

    public render() {
        return(
            <div className='header-panel-div'>
                <MenuBar baseTheme={this.props.baseTheme} stylePosition='top-fixed'>
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
                </MenuBar>
            </div>
        );
    }
}
