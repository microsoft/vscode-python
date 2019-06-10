// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

//import copy from 'copy-to-clipboard';
import * as React from 'react';
import { Tool, Value } from 'react-svg-pan-zoom';
import * as uuid from 'uuid/v4';


import { createDeferred } from '../../client/common/utils/async';
import { IPlotViewerMapping, PlotViewerMessages } from '../../client/datascience/plotting/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { StyleInjector } from '../react-common/styleInjector';
import { SvgList } from '../react-common/svgList';
import { SvgViewer } from '../react-common/svgViewer';

// Our css has to come after in order to override body styles
import './mainPanel.css';
import { TestSvg } from './testSvg';
import { Toolbar } from './toolbar';

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
    tool: Tool;
}

const HeightRegex = /(\<svg.*height=\")(.*?)\"/;
const WidthRegex = /(\<svg.*width=\")(.*?)\"/;

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private container: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
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

        this.state = {images, thumbnails, sizes, values, ids, tool: 'pan', currentImage: images.length > 0 ? 0 : -1};
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
                {this.renderToolbar()}
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

    private renderToolbar() {
        const prev = this.state.currentImage > 0 ? this.prevClicked : undefined;
        const next = this.state.currentImage < this.state.images.length - 1 ? this.nextClicked : undefined;
        return (
            <Toolbar
                baseTheme={this.props.baseTheme}
                changeTool={this.changeTool}
                exportButtonClicked={this.exportCurrent}
                copyButtonClicked={this.copyCurrent}
                prevButtonClicked={prev}
                nextButtonClicked={next} />
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
                    tool={this.state.tool}
                    changeValue={this.changeCurrentValue}
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

    private changeTool = (tool: Tool) => {
        this.setState({tool});
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

    private sendMessage<M extends IPlotViewerMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }

    private exportCurrent = () => {
        this.sendMessage(PlotViewerMessages.ExportPlot, this.state.images[this.state.currentImage]);
    }

    private copyCurrent = async () => {
        // Try copying locally
        // First create a dummy canvas
        if (this.container && this.container.current) {
            const doc = this.container.current.ownerDocument;
            if (doc) {
                const canvas = doc.createElement('canvas');
                if (canvas) {
                    canvas.width = parseInt(this.state.sizes[this.state.currentImage].width, 10);
                    canvas.height = parseInt(this.state.sizes[this.state.currentImage].height, 10);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        let waitable = createDeferred();
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        const svgBlob = new Blob([this.state.images[this.state.currentImage]], { type: 'image/svg+xml;charset=utf-8' });
                        const img = new Image();
                        const url = window.URL.createObjectURL(svgBlob);
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0);
                            waitable.resolve();
                        };
                        img.src = url;
                        await waitable.promise;

                        // Now copy the output.
                        // copy(canvas.toDataURL('png'), { format: 'URL' });
                        waitable = createDeferred();
                        const imgPng = doc.createElement('img');
                        imgPng.width = canvas.width;
                        imgPng.height = canvas.height;
                        doc.body.appendChild(imgPng);
                        imgPng.onload = () => {
                            waitable.resolve();
                        };
                        imgPng.src = canvas.toDataURL('png');
                        await waitable.promise;
                        const selection = window.getSelection();
                        if (selection) {
                            selection.removeAllRanges();
                            const range = doc.createRange();
                            range.selectNodeContents(imgPng);
                            selection.addRange(range);
                            try {
                                const success = doc.execCommand('copy');
                                window.console.log(`Copy was ${success}`);
                            } catch (err) {
                                window.console.log(err);
                            }

                        }
                        doc.body.removeChild(imgPng);
                    }
                    canvas.remove();
                }
            }
        }
        // copy(this.state.images[this.state.currentImage], {
        //     format: 'image/svg+xml'
        // });
    }

    private prevClicked = () => {
        this.changeCurrentImage(this.state.currentImage - 1);
    }

    private nextClicked = () => {
        this.changeCurrentImage(this.state.currentImage + 1);
    }
}
