// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './toolbarPanel.css';

import * as React from 'react';

import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { MenuBar } from './menuBar';

export interface IToolbarPanelProps {
    baseTheme: string;
    canCollapseAll: boolean;
    canExpandAll: boolean;
    canExport: boolean;
    canUndo: boolean;
    canRedo: boolean;
    skipDefault?: boolean;
    addMarkdown(): void;
    collapseAll(): void;
    expandAll(): void;
    export(): void;
    restartKernel(): void;
    interruptKernel(): void;
    undo(): void;
    redo(): void;
    clearAll(): void;
}

export class ToolbarPanel extends React.Component<IToolbarPanelProps> {
    constructor(prop: IToolbarPanelProps) {
        super(prop);
    }

    public render() {
        return(
            <div id='toolbar-panel'>
                <MenuBar baseTheme={this.props.baseTheme}>
                    {this.renderExtraButtons()}
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.collapseAll} disabled={!this.props.canCollapseAll} tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.CollapseAll}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.expandAll} disabled={!this.props.canExpandAll} tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ExpandAll}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.export} disabled={!this.props.canExport} tooltip={getLocString('DataScience.export', 'Export as Jupyter Notebook')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.restartKernel} tooltip={getLocString('DataScience.restartServer', 'Restart iPython Kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Restart}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.interruptKernel} tooltip={getLocString('DataScience.interruptKernel', 'Interrupt iPython Kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Interrupt}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.undo} disabled={!this.props.canUndo} tooltip={getLocString('DataScience.undo', 'Undo')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Undo}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.redo} disabled={!this.props.canRedo} tooltip={getLocString('DataScience.redo', 'Redo')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Redo}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.clearAll} tooltip={getLocString('DataScience.clearAll', 'Remove All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Cancel}/>
                    </ImageButton>
                </MenuBar>
            </div>
        );
    }

    private renderExtraButtons = () => {
        if (!this.props.skipDefault) {
            const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;
            return <ImageButton baseTheme={baseTheme} onClick={this.props.addMarkdown} tooltip='Add Markdown Test'>M</ImageButton>;
        }

        return null;
    }
}
