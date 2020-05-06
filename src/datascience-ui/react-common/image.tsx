// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as React from 'react';
// tslint:disable-next-line:import-name match-default-export-name
import InlineSVG from 'svg-inline-react';

// This react component loads our svg files inline so that we can load them in vscode as it no longer
// supports loading svgs from disk. Please put new images in this list as appropriate.
export enum ImageName {
    Cancel,
    CollapseAll,
    ExpandAll,
    GoToSourceCode,
    Interrupt,
    OpenInNewWindow,
    PopIn,
    PopOut,
    Redo,
    Restart,
    SaveAs,
    Undo,
    Pan,
    Zoom,
    ZoomOut,
    Next,
    Prev,
    Copy,
    GatherCode,
    Up,
    Down,
    Run,
    RunAbove,
    RunBelow,
    InsertAbove,
    InsertBelow,
    SwitchToCode,
    SwitchToMarkdown,
    OpenPlot,
    RunAll,
    Delete,
    VariableExplorer,
    ExportToPython,
    ClearAllOutput,
    JupyterServerConnected,
    JupyterServerDisconnected,
    RunByLine
}

// All of the images must be 'require' so that webpack doesn't rewrite the import as requiring a .default.
// tslint:disable:no-require-imports
const images: { [key: string]: { light: string; dark: string } } = {
    Cancel: {
        light: require('./images/Cancel/Cancel_16xMD_vscode.svg'),
        dark: require('./images/Cancel/Cancel_16xMD_vscode_dark.svg')
    },
    CollapseAll: {
        light: require('./images/CollapseAll/CollapseAll_16x_vscode.svg'),
        dark: require('./images/CollapseAll/CollapseAll_16x_vscode_dark.svg')
    },
    ExpandAll: {
        light: require('./images/ExpandAll/ExpandAll_16x_vscode.svg'),
        dark: require('./images/ExpandAll/ExpandAll_16x_vscode_dark.svg')
    },
    GatherCode: {
        light: require('./images/GatherCode/gather_light.svg'),
        dark: require('./images/GatherCode/gather_dark.svg')
    },
    GoToSourceCode: {
        light: require('./images/GoToSourceCode/GoToSourceCode_16x_vscode.svg'),
        dark: require('./images/GoToSourceCode/GoToSourceCode_16x_vscode_dark.svg')
    },
    Interrupt: {
        light: require('./images/Interrupt/Interrupt_16x_vscode.svg'),
        dark: require('./images/Interrupt/Interrupt_16x_vscode_dark.svg')
    },
    OpenInNewWindow: {
        light: require('./images/OpenInNewWindow/OpenInNewWindow_16x_vscode.svg'),
        dark: require('./images/OpenInNewWindow/OpenInNewWindow_16x_vscode_dark.svg')
    },
    PopIn: {
        light: require('./images/PopIn/PopIn_16x_vscode.svg'),
        dark: require('./images/PopIn/PopIn_16x_vscode_dark.svg')
    },
    PopOut: {
        light: require('./images/PopOut/PopOut_16x_vscode.svg'),
        dark: require('./images/PopOut/PopOut_16x_vscode_dark.svg')
    },
    Redo: {
        light: require('./images/Redo/Redo_16x_vscode.svg'),
        dark: require('./images/Redo/Redo_16x_vscode_dark.svg')
    },
    Restart: {
        light: require('./images/Restart/Restart_grey_16x_vscode.svg'),
        dark: require('./images/Restart/Restart_grey_16x_vscode_dark.svg')
    },
    SaveAs: {
        light: require('./images/SaveAs/SaveAs_16x_vscode.svg'),
        dark: require('./images/SaveAs/SaveAs_16x_vscode_dark.svg')
    },
    Undo: {
        light: require('./images/Undo/Undo_16x_vscode.svg'),
        dark: require('./images/Undo/Undo_16x_vscode_dark.svg')
    },
    Next: {
        light: require('./images/Next/next.svg'),
        dark: require('./images/Next/next-inverse.svg')
    },
    Prev: {
        light: require('./images/Prev/previous.svg'),
        dark: require('./images/Prev/previous-inverse.svg')
    },
    // tslint:disable-next-line: no-suspicious-comment
    // Todo: Get new images from a designer. These are all temporary.
    Pan: {
        light: require('./images/Pan/pan.svg'),
        dark: require('./images/Pan/pan_inverse.svg')
    },
    Zoom: {
        light: require('./images/Zoom/zoom.svg'),
        dark: require('./images/Zoom/zoom_inverse.svg')
    },
    ZoomOut: {
        light: require('./images/ZoomOut/zoomout.svg'),
        dark: require('./images/ZoomOut/zoomout_inverse.svg')
    },
    Copy: {
        light: require('./images/Copy/copy.svg'),
        dark: require('./images/Copy/copy_inverse.svg')
    },
    Up: {
        light: require('./images/Up/up.svg'),
        dark: require('./images/Up/up-inverse.svg')
    },
    Down: {
        light: require('./images/Down/down.svg'),
        dark: require('./images/Down/down-inverse.svg')
    },
    Run: {
        light: require('./images/Run/run-light.svg'),
        dark: require('./images/Run/run-dark.svg')
    },
    RunAbove: {
        light: require('./images/RunAbove/runabove.svg'),
        dark: require('./images/RunAbove/runabove-inverse.svg')
    },
    RunBelow: {
        light: require('./images/RunBelow/runbelow.svg'),
        dark: require('./images/RunBelow/runbelow-inverse.svg')
    },
    InsertAbove: {
        light: require('./images/InsertAbove/above.svg'),
        dark: require('./images/InsertAbove/above-inverse.svg')
    },
    InsertBelow: {
        light: require('./images/InsertBelow/below.svg'),
        dark: require('./images/InsertBelow/below-inverse.svg')
    },
    SwitchToCode: {
        light: require('./images/SwitchToCode/switchtocode.svg'),
        dark: require('./images/SwitchToCode/switchtocode-inverse.svg')
    },
    SwitchToMarkdown: {
        light: require('./images/SwitchToMarkdown/switchtomarkdown.svg'),
        dark: require('./images/SwitchToMarkdown/switchtomarkdown-inverse.svg')
    },
    OpenPlot: {
        light: require('./images/OpenPlot/plot_light.svg'),
        dark: require('./images/OpenPlot/plot_dark.svg')
    },
    RunAll: {
        light: require('./images/RunAll/run_all_light.svg'),
        dark: require('./images/RunAll/run_all_dark.svg')
    },
    Delete: {
        light: require('./images/Delete/delete_light.svg'),
        dark: require('./images/Delete/delete_dark.svg')
    },
    VariableExplorer: {
        light: require('./images/VariableExplorer/variable_explorer_light.svg'),
        dark: require('./images/VariableExplorer/variable_explorer_dark.svg')
    },
    ExportToPython: {
        light: require('./images/ExportToPython/export_to_python_light.svg'),
        dark: require('./images/ExportToPython/export_to_python_dark.svg')
    },
    ClearAllOutput: {
        light: require('./images/ClearAllOutput/clear_all_output_light.svg'),
        dark: require('./images/ClearAllOutput/clear_all_output_dark.svg')
    },
    JupyterServerConnected: {
        light: require('./images/JupyterServerConnected/connected-light.svg'),
        dark: require('./images/JupyterServerConnected/connected-dark.svg')
    },
    JupyterServerDisconnected: {
        light: require('./images/JupyterServerDisconnected/disconnected-light.svg'),
        dark: require('./images/JupyterServerDisconnected/disconnected-dark.svg')
    },
    RunByLine: {
        light: require('./images/RunByLine/runbyline_light.svg'),
        dark: require('./images/RunByLine/runbyline_dark.svg')
    }
};

interface IImageProps {
    baseTheme: string;
    image: ImageName;
    class: string;
}

export class Image extends React.Component<IImageProps> {
    constructor(props: IImageProps) {
        super(props);
    }

    public render() {
        const key = ImageName[this.props.image].toString();
        const image = images.hasOwnProperty(key) ? images[key] : images.Cancel; // Default is cancel.
        const source = this.props.baseTheme.includes('dark') ? image.dark : image.light;
        return <InlineSVG className={this.props.class} src={source} />;
    }
}
