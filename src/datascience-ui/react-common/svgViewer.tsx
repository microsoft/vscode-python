// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { POSITION_TOP, ReactSVGPanZoom, Tool, Value } from 'react-svg-pan-zoom';
import { SvgLoader } from 'react-svgmt';
import { AutoSizer } from 'react-virtualized';
import './svgViewer.css';

interface ISvgViewerProps {
    svg: string;
    id: string; // Unique identified for this svg (in case they are the same)
    baseTheme: string;
    themeMatplotlibPlots: boolean;
    size: { width: string; height: string };
    defaultValue: Value | undefined;
    tool: Tool;
    changeValue(value: Value): void;
}

interface ISvgViewerState {
    value: Value;
    tool: Tool;
}

export class SvgViewer extends React.Component<ISvgViewerProps, ISvgViewerState> {
    private svgPanZoomRef: React.RefObject<ReactSVGPanZoom> = React.createRef<ReactSVGPanZoom>();
    constructor(props: ISvgViewerProps) {
        super(props);
        // tslint:disable-next-line: no-object-literal-type-assertion
        this.state = { value: props.defaultValue ? props.defaultValue : ({} as Value), tool: props.tool };
    }

    public componentDidUpdate(prevProps: ISvgViewerProps) {
        // May need to update state if props changed
        if (prevProps.defaultValue !== this.props.defaultValue || this.props.id !== prevProps.id) {
            this.setState({
                // tslint:disable-next-line: no-object-literal-type-assertion
                value: this.props.defaultValue ? this.props.defaultValue : ({} as Value),
                tool: this.props.tool,
            });
        } else if (this.props.tool !== this.state.tool) {
            this.setState({ tool: this.props.tool });
        }
    }

    public move(offsetX: number, offsetY: number) {
        if (this.svgPanZoomRef && this.svgPanZoomRef.current) {
            this.svgPanZoomRef.current.pan(offsetX, offsetY);
        }
    }

    public zoom(amount: number) {
        if (this.svgPanZoomRef && this.svgPanZoomRef.current) {
            this.svgPanZoomRef.current.zoomOnViewerCenter(amount);
        }
    }

    public render() {
        const plotBackground = this.props.themeMatplotlibPlots
            ? 'var(--override-widget-background, var(--vscode-notifications-background))'
            : 'white';
        return (
            <AutoSizer>
                {({ height, width }) =>
                    width === 0 || height === 0 ? null : (
                        <ReactSVGPanZoom
                            ref={this.svgPanZoomRef}
                            width={width}
                            height={height}
                            toolbarProps={{ position: POSITION_TOP }}
                            detectAutoPan={true}
                            tool={this.state.tool}
                            value={this.state.value}
                            onChangeTool={this.changeTool}
                            onChangeValue={this.changeValue}
                            customToolbar={this.renderToolbar}
                            customMiniature={this.renderMiniature}
                            SVGBackground={'transparent'}
                            background={plotBackground}
                            detectWheel={true}
                        >
                            <svg width={this.props.size.width} height={this.props.size.height}>
                                <SvgLoader svgXML={this.props.svg} />
                            </svg>
                        </ReactSVGPanZoom>
                    )
                }
            </AutoSizer>
        );
    }

    private changeTool = (tool: Tool) => {
        this.setState({ tool });
    };

    private changeValue = (value: Value) => {
        this.setState({ value });
        this.props.changeValue(value);
    };

    private renderToolbar = () => {
        // Hide toolbar too
        return <div />;
    };

    private renderMiniature = () => {
        return (
            <div /> // Hide miniature
        );
    };
}
