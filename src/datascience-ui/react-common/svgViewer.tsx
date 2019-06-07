// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { POSITION_TOP, Tool, UncontrolledReactSVGPanZoom, Value } from 'react-svg-pan-zoom';
import { SvgLoader } from 'react-svgmt';
import { AutoSizer } from 'react-virtualized';
import { Image, ImageName } from './image';
import { ImageButton } from './imageButton';
import { getLocString } from './locReactSide';

import './svgViewer.css';

interface ISvgViewerProps {
    svg: string;
    baseTheme: string;
    size: {width: string; height: string};
    prevButtonClicked?(): void;
    nextButtonClicked?(): void;
    exportButtonClicked?(): void;
}

interface IToolbarProps {
    baseTheme: string;
    tool: Tool;
    value: Value;
    onChangeTool(tool: Tool): void;
    onChangeValue(value: Value): void;
    prevButtonClicked?(): void;
    nextButtonClicked?(): void;
    exportButtonClicked?(): void;
}

class SvgViewerToolbar extends React.Component<IToolbarProps> {
    constructor(props: IToolbarProps) {
        super(props);
    }

    public render() {
        return (
            <div id='svg-toolbar-panel'>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.prevButtonClicked} disabled={!this.props.prevButtonClicked} tooltip={getLocString('DataScience.previous', 'Previous')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Prev}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.nextButtonClicked} disabled={!this.props.nextButtonClicked} tooltip={getLocString('DataScience.next', 'Next')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Next}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.pan} tooltip={getLocString('DataScience.pan', 'Pan')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Pan}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.zoomIn} tooltip={getLocString('DataScience.zoomIn', 'Zoom in')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Zoom}/>
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.zoomOut} tooltip={getLocString('DataScience.zoomOut', 'Zoom Out')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ZoomOut}/>
                    </ImageButton>
                    {this.props.exportButtonClicked ?
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.props.exportButtonClicked} tooltip={getLocString('DataScience.exportPlot', 'Export to different formats.')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs}/>
                    </ImageButton> : null
                    }
            </div>
        );
    }

    private pan = () => {
        this.props.onChangeTool('pan');
    }

    private zoomIn = () => {
        this.props.onChangeTool('zoom-in');
    }

    private zoomOut = () => {
        this.props.onChangeTool('zoom-out');
    }
}

export class SvgViewer extends React.Component<ISvgViewerProps> {
    private svgPanZoomRef : React.RefObject<UncontrolledReactSVGPanZoom> = React.createRef<UncontrolledReactSVGPanZoom>();
    constructor(props: ISvgViewerProps) {
        super(props);
    }

    public render() {
        return (
            <AutoSizer>
            {({ height, width }) => (
                width === 0 || height === 0 ? null :
                <UncontrolledReactSVGPanZoom
                    ref={this.svgPanZoomRef}
                    width={width}
                    height={height}
                    toolbarProps={{position: POSITION_TOP}}
                    detectAutoPan={true}
                    onChangeTool={this.changeTool}
                    onChangeValue={this.changeValue}
                    customToolbar={this.renderToolbar}
                    customMiniature={this.renderMiniature}
                    detectWheel={true}>
                    <svg width={this.props.size.width} height={this.props.size.height}>
                        <SvgLoader svgXML={this.props.svg}/>
                    </svg>
                </UncontrolledReactSVGPanZoom>
            )}
            </AutoSizer>
        );
    }

    private changeTool = (_tool?: Tool) => {
        // Do nothing
    }

    private changeValue = (_value?: Value) => {
        // Do nothing
    }

    private renderToolbar = (toolbarProps: IToolbarProps) => {
        // If toolbar is still saying none, change it
        if (toolbarProps.tool === 'none') {
            toolbarProps.onChangeTool('pan');
        }

        return (
            <SvgViewerToolbar baseTheme={this.props.baseTheme} tool={toolbarProps.tool} value={toolbarProps.value} onChangeTool={toolbarProps.onChangeTool} onChangeValue={toolbarProps.onChangeValue} />
        );
    }

    private renderMiniature = () => {
        return (
            <div /> // Hide miniature
        );
    }
}
