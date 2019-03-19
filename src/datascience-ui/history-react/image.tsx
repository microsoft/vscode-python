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
    PopIn,
    PopOut,
    Redo,
    Restart,
    SaveAs,
    Undo
}

// All of the images must be 'require' so that webpack doesn't rewrite the import as requiring a .default.
// tslint:disable:no-require-imports
const images: { [key: string] : { light: string; dark: string } } = {
    Cancel:
        {
            light: require('./images/Cancel/Cancel_16xMD_vscode.svg'),
            dark : require('./images/Cancel/Cancel_16xMD_vscode_dark.svg')
        },
    CollapseAll:
        {
            light: require('./images/CollapseAll/CollapseAll_16x_vscode.svg'),
            dark : require('./images/CollapseAll/CollapseAll_16x_vscode_dark.svg')
        },
    ExpandAll:
        {
            light: require('./images/ExpandAll/ExpandAll_16x_vscode.svg'),
            dark : require('./images/ExpandAll/ExpandAll_16x_vscode_dark.svg')
        },
    GoToSourceCode:
        {
            light: require('./images/GoToSourceCode/GoToSourceCode_16x_vscode.svg'),
            dark : require('./images/GoToSourceCode/GoToSourceCode_16x_vscode_dark.svg')
        },
    Interrupt:
        {
            light: require('./images/Interrupt/Interrupt_16x_vscode.svg'),
            dark : require('./images/Interrupt/Interrupt_16x_vscode_dark.svg')
        },
    PopIn:
        {
            light: require('./images/PopIn/PopIn_16x_vscode.svg'),
            dark : require('./images/PopIn/PopIn_16x_vscode_dark.svg')
        },
    PopOut:
        {
            light: require('./images/PopOut/PopOut_16x_vscode.svg'),
            dark : require('./images/PopOut/PopOut_16x_vscode_dark.svg')
        },
    Redo:
        {
            light: require('./images/Redo/Redo_16x_vscode.svg'),
            dark : require('./images/Redo/Redo_16x_vscode_dark.svg')
        },
    Restart:
        {
            light: require('./images/Restart/Restart_grey_16x_vscode.svg'),
            dark : require('./images/Restart/Restart_grey_16x_vscode_dark.svg')
        },
    SaveAs:
        {
            light: require('./images/SaveAs/SaveAs_16x_vscode.svg'),
            dark : require('./images/SaveAs/SaveAs_16x_vscode_dark.svg')
        },
    Undo:
        {
            light: require('./images/Undo/Undo_16x_vscode.svg'),
            dark : require('./images/Undo/Undo_16x_vscode_dark.svg')
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
        const key = (ImageName[this.props.image]).toString();
        const image = images.hasOwnProperty(key) ?
            images[key] : images['Cancel']; // Default is cancel.
        const source = this.props.baseTheme.includes('dark') ? image.dark : image.light;
        return (
            <InlineSVG className={this.props.class} src={source}/>
        );
    }

}
