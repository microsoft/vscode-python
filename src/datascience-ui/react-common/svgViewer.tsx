// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { POSITION_TOP, Tool, ReactSVGPanZoom, Value } from 'react-svg-pan-zoom';
import { SvgLoader } from 'react-svgmt';
import { AutoSizer } from 'react-virtualized';
import { Image, ImageName } from './image';
import { ImageButton } from './imageButton';
import { getLocString } from './locReactSide';

import './svgViewer.css';

interface ISvgViewerProps {
    svg: string;
    id: string; // Unique identified for this svg (in case they are the same)
    baseTheme: string;
    size: {width: string; height: string};
    defaultValue: Value | undefined;
    changeValue(value: Value): void;
    prevButtonClicked?(): void;
    nextButtonClicked?(): void;
    exportButtonClicked?(): void;
}

interface ISvgViewerState {
    value: Value;
    tool: Tool;
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

export class SvgViewer extends React.Component<ISvgViewerProps, ISvgViewerState> {
    private svgPanZoomRef : React.RefObject<ReactSVGPanZoom> = React.createRef<ReactSVGPanZoom>();
    constructor(props: ISvgViewerProps) {
        super(props);
        this.state = { value: props.defaultValue ? props.defaultValue : {} as Value, tool: 'pan'};
    }

    public componentDidUpdate(prevProps: ISvgViewerProps) {
        // May need to update state if props changed
        if (prevProps.defaultValue !== this.props.defaultValue || this.props.id !== prevProps.id) {
            this.setState( {
                value: this.props.defaultValue ? this.props.defaultValue : {} as Value
            })
        }
    }

    public render() {
        return (
            <AutoSizer>
            {({ height, width }) => (
                width === 0 || height === 0 ? null :
                <ReactSVGPanZoom
                    ref={this.svgPanZoomRef}
                    width={width}
                    height={height}
                    toolbarProps={{position: POSITION_TOP}}
                    detectAutoPan={true}
                    tool={this.state.tool}
                    value={this.state.value}
                    onChangeTool={this.changeTool}
                    onChangeValue={this.changeValue}
                    customToolbar={this.renderToolbar}
                    customMiniature={this.renderMiniature}
                    SVGBackground={'transparent'}
                    background={'var(--override-widget-background, var(--vscode-notifications-background))'}
                    detectWheel={true}>
                    <svg width={this.props.size.width} height={this.props.size.height}>
                        <SvgLoader svgXML={this.props.svg}/>
                    </svg>
                </ReactSVGPanZoom>
            )}
            </AutoSizer>
        );
    }

    private changeTool = (tool: Tool) => {
        this.setState({tool})
    }

    private changeValue = (value: Value) => {
        this.setState({value});
        this.props.changeValue(value);
    }

    private renderToolbar = (toolbarProps: IToolbarProps) => {
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
