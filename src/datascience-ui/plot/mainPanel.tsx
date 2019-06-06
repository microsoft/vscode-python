// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { ReactSVGPanZoom } from 'react-svg-pan-zoom';
import { AutoSizer } from 'react-virtualized';

import { IPlotViewerMapping, PlotViewerMessages } from '../../client/datascience/plotting/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
//import { ReactFromHtml } from '../react-common/reactFromHtml';
import { StyleInjector } from '../react-common/styleInjector';

// Our css has to come after in order to override body styles
import './mainPanel.css';

export interface IMainPanelProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

//tslint:disable:no-any
interface IMainPanelState {
    images: string[];
}

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private container: React.Ref<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private postOffice: PostOffice = new PostOffice();

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);
        this.state = {images: []};
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the plot viewer code we have started.
        this.postOffice.sendMessage<IPlotViewerMapping, 'started'>(PlotViewerMessages.Started);
    }

    public componentWillUnmount() {
        this.postOffice.removeHandler(this);
        this.postOffice.dispose();
    }

    public render = () => {
        return (
            <div className='main-panel' ref={this.container}>
                <StyleInjector
                    expectingDark={this.props.baseTheme !== 'vscode-light'}
                    postOffice={this.postOffice} />
                {this.renderPlots()}
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case PlotViewerMessages.SendPlot:
                this.addPlot(payload);
                break;

            default:
                break;
        }

        return false;
    }

    private addPlot(payload: any) {
        this.setState({
            images: [...this.state.images, payload as string]
        });
    }

    private renderPlots() {
        // Just render last plot for now
        const lastPlot = this.state.images.length > 0 ? this.state.images[this.state.images.length - 1] : undefined;
        if (lastPlot) {
            return (
                <AutoSizer>
                {({ height, width }) => (
                    width === 0 || height === 0 ? null :
                    <ReactSVGPanZoom width={width} height={height}>
                        <svg viewBox="0 0 16 16">
                            <title>PopIn_16x</title><g id="canvas">
                                <path className="icon-canvas-transparent" d="M16,16H0V0H16Z"/></g><g id="outline" >
                                    <path className="icon-vs-out" d="M16,0V15H13V5.121L7.121,11H12v3H2V4H5V8.879L10.879,3H1V0Z" /></g><g id="iconBg">
                                        <path className="icon-vs-bg" d="M15,1V14H14V2H2V1ZM11.146,4.146,4,11.293V5H3v8h8V12H4.707l7.147-7.146Z"/></g>
                                        </svg>
                    </ReactSVGPanZoom>
                )}
                </AutoSizer>
            );
        }

        return null;
    }
}
