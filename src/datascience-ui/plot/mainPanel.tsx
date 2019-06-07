// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import * as uuid from 'uuid/v4';
import { Value } from 'react-svg-pan-zoom';

import { IPlotViewerMapping, PlotViewerMessages } from '../../client/datascience/plotting/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { StyleInjector } from '../react-common/styleInjector';
import { SvgList } from '../react-common/svgList';
import { SvgViewer } from '../react-common/svgViewer';

// Our css has to come after in order to override body styles
import './mainPanel.css';
import { TestSvg } from './testSvg';

//import { ReactFromHtml } from '../react-common/reactFromHtml';
export interface IMainPanelProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

interface ISize {
    width: string;
    height: string;
}

//tslint:disable:no-any
interface IMainPanelState {
    images: string[];
    thumbnails: string[];
    sizes: ISize[];
    values: (Value | undefined)[];
    ids: string[];
    currentImage: number;
}

const HeightRegex = /(\<svg.*height=\")(.*?)\"/;
const WidthRegex = /(\<svg.*width=\")(.*?)\"/;

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private container: React.Ref<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private postOffice: PostOffice = new PostOffice();
    private currentValue: Value | undefined;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);
        const images = !props.skipDefault ?
            [TestSvg, TestSvg, TestSvg] :
            [];
        const thumbnails = images.map(this.generateThumbnail);
        const sizes = images.map(this.extractSize);
        const values = images.map(_i => undefined);
        const ids = images.map(_i => uuid());

        this.state = {images, thumbnails, sizes, values, ids, currentImage: images.length > 0 ? 0 : -1};
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
                {this.renderThumbnails()}
                {this.renderPlot()}
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
            images: [...this.state.images, payload as string],
            thumbnails: [...this.state.thumbnails, this.generateThumbnail(payload)],
            sizes: [...this.state.sizes, this.extractSize(payload)],
            values: [...this.state.values, undefined],
            ids: [...this.state.ids, uuid()],
            currentImage: this.state.currentImage + 1
        });
    }

    private renderThumbnails() {
        return (
            <SvgList images={this.state.thumbnails} currentImage={this.state.currentImage} imageClicked={this.imageClicked}/>
        );
    }

    private renderPlot() {
        // Render current plot
        const currentPlot = this.state.currentImage >= 0 ? this.state.images[this.state.currentImage] : undefined;
        const currentSize = this.state.currentImage >= 0 ? this.state.sizes[this.state.currentImage] : undefined;
        const currentId = this.state.currentImage >= 0 ? this.state.ids[this.state.currentImage] : undefined;
        const value = this.state.currentImage >= 0 ? this.state.values[this.state.currentImage] : undefined;
        if (currentPlot && currentSize && currentId) {
            return (
                <SvgViewer
                    baseTheme={this.props.baseTheme}
                    svg={currentPlot}
                    id={currentId}
                    size={currentSize}
                    defaultValue={value}
                    changeValue={this.changeCurrentValue}
                    exportButtonClicked={this.exportCurrent}
                    prevButtonClicked={this.state.currentImage > 0 ? this.prevClicked : undefined}
                    nextButtonClicked={this.state.currentImage < this.state.images.length - 1 ? this.nextClicked : undefined}
                />
            );
        }

        return null;
    }

    private generateThumbnail(image: string): string {
        // A 'thumbnail' is really just an svg image with
        // the width and height forced to 100%
        const h = image.replace(HeightRegex, '$1100%\"');
        return h.replace(WidthRegex, '$1100%\"');
    }

    private changeCurrentValue = (value: Value) => {
        this.currentValue = {...value};
    }

    private extractSize(image: string): ISize {
        const heightMatch = HeightRegex.exec(image);
        let height = '100px';
        if (heightMatch && heightMatch.length > 2) {
            height = heightMatch[2];
        }
        const widthMatch = WidthRegex.exec(image);
        let width = '100px';
        if (widthMatch && widthMatch.length > 2) {
            width = widthMatch[2];
        }

        return {
            height,
            width
        };
    }

    private changeCurrentImage(index: number) {
        // Update our state for our current image and our current value
        if (index !== this.state.currentImage) {
            const newValues = [...this.state.values];
            newValues[this.state.currentImage] = this.currentValue;
            this.setState({
                currentImage: index,
                values: newValues
            });

            // Reassign the current value to the new index so we track it.
            this.currentValue = newValues[index];
        }
    }

    private imageClicked = (index: number) => {
        this.changeCurrentImage(index);
    }

    private exportCurrent = () => {
        // Do nothing for now.
    }

    private prevClicked = () => {
        this.changeCurrentImage(this.state.currentImage - 1);
    }

    private nextClicked = () => {
        this.changeCurrentImage(this.state.currentImage + 1);
    }
}
