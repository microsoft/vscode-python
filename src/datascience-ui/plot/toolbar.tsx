// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { Tool } from 'react-svg-pan-zoom';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';

interface IToolbarProps {
    baseTheme: string;
    changeTool(tool: Tool): void;
    prevButtonClicked?(): void;
    nextButtonClicked?(): void;
    exportButtonClicked(): void;
    copyButtonClicked(): void;
    deleteButtonClicked?(): void;
}

export class Toolbar extends React.Component<IToolbarProps> {
    constructor(props: IToolbarProps) {
        super(props);
    }

    public render() {
        return (
            <div id="plot-toolbar-panel">
                <ImageButton
                    baseTheme={this.props.baseTheme}
                    onClick={this.props.prevButtonClicked}
                    disabled={!this.props.prevButtonClicked}
                    tooltip={getLocString('DataScience.previousPlot', 'Previous')}
                >
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Prev} />
                </ImageButton>
                <ImageButton
                    baseTheme={this.props.baseTheme}
                    onClick={this.props.nextButtonClicked}
                    disabled={!this.props.nextButtonClicked}
                    tooltip={getLocString('DataScience.nextPlot', 'Next')}
                >
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Next} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.pan} tooltip={getLocString('DataScience.panPlot', 'Pan')}>
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Pan} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.zoomIn} tooltip={getLocString('DataScience.zoomInPlot', 'Zoom in')}>
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Zoom} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.zoomOut} tooltip={getLocString('DataScience.zoomOutPlot', 'Zoom out')}>
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.ZoomOut} />
                </ImageButton>
                {/* This isn't possible until VS Code supports copying images to the clipboard. See https://github.com/microsoft/vscode/issues/217
                     <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.copyButtonClicked} tooltip={getLocString('DataScience.copyPlot', 'Copy image to clipboard')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Copy}/>
                    </ImageButton> */}
                <ImageButton
                    baseTheme={this.props.baseTheme}
                    onClick={this.props.exportButtonClicked}
                    tooltip={getLocString('DataScience.exportPlot', 'Export to different formats.')}
                >
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.SaveAs} />
                </ImageButton>
                <ImageButton
                    baseTheme={this.props.baseTheme}
                    onClick={this.props.deleteButtonClicked}
                    disabled={!this.props.deleteButtonClicked}
                    tooltip={getLocString('DataScience.deletePlot', 'Remove')}
                >
                    <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Delete} />
                </ImageButton>
            </div>
        );
    }

    private pan = () => {
        this.props.changeTool('pan');
    };

    private zoomIn = () => {
        this.props.changeTool('zoom-in');
    };

    private zoomOut = () => {
        this.props.changeTool('zoom-out');
    };
}
