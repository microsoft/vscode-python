// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

//import copy from 'copy-to-clipboard';
import * as React from 'react';
import { Tool, Value } from 'react-svg-pan-zoom';
import * as uuid from 'uuid/v4';

import { createDeferred } from '../../client/common/utils/async';
import { RegExpValues } from '../../client/datascience/constants';
import { IPlotViewerMapping, PlotViewerMessages } from '../../client/datascience/plotting/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { StyleInjector } from '../react-common/styleInjector';
import { SvgList } from '../react-common/svgList';
import { SvgViewer } from '../react-common/svgViewer';

// Our css has to come after in order to override body styles
import './mainPanel.css';
import { TestSvg } from './testSvg';
import { Toolbar } from './toolbar';

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

const PanKeyboardSize = 10;

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private container: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private viewer: React.RefObject<SvgViewer> = React.createRef<SvgViewer>();
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

        // Listen to key events
        window.addEventListener('keydown', this.onKeyDown);
    }

    public componentWillUnmount() {
        this.postOffice.removeHandler(this);
        this.postOffice.dispose();
        // Stop listening to key events
        window.removeEventListener('keydown', this.onKeyDown);
    }

    public render = () => {
        return (
            <div className='main-panel' role='group' ref={this.container}>
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

    private onKeyDown = (event: KeyboardEvent) => {
        if (!event.ctrlKey) {
            switch (event.key) {
                case 'ArrowRight':
                    if (this.state.currentImage < this.state.images.length - 1) {
                        this.setState({currentImage: this.state.currentImage + 1});
                    }
                    break;

                case 'ArrowLeft':
                    if (this.state.currentImage > 0) {
                        this.setState({currentImage: this.state.currentImage - 1});
                    }
                    break;

                default:
                    break;
            }
        } else if (event.ctrlKey && !event.altKey && this.viewer && this.viewer.current) {
            switch (event.key) {
                case 'ArrowRight':
                    this.viewer.current.move(PanKeyboardSize, 0);
                    break;

                case 'ArrowLeft':
                    this.viewer.current.move(-PanKeyboardSize, 0);
                    break;

                case 'ArrowUp':
                    this.viewer.current.move(0, -PanKeyboardSize);
                    break;

                case 'ArrowDown':
                    this.viewer.current.move(0, PanKeyboardSize);
                    break;

                default:
                    break;
            }
        } else if (event.ctrlKey && event.altKey && this.viewer && this.viewer.current) {
            switch (event.key) {
                case '+':
                    this.viewer.current.zoom(1.5);
                    break;

                case '-':
                    this.viewer.current.zoom(0.66666);
                    break;

                default:
                    break;
            }
        }
    }

    private addPlot(payload: any) {
        this.setState({
            images: [...this.state.images, payload as string],
            thumbnails: [...this.state.thumbnails, this.generateThumbnail(payload)],
            sizes: [...this.state.sizes, this.extractSize(payload)],
            values: [...this.state.values, undefined],
            ids: [...this.state.ids, uuid()],
            currentImage: this.state.images.length
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
        const deleteClickHandler = this.state.currentImage !== -1 ? this.deleteClicked : undefined;
        return (
            <Toolbar
                baseTheme={this.props.baseTheme}
                changeTool={this.changeTool}
                exportButtonClicked={this.exportCurrent}
                copyButtonClicked={this.copyCurrent}
                prevButtonClicked={prev}
                nextButtonClicked={next}
                deleteButtonClicked={deleteClickHandler} />
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
                    ref={this.viewer}
                />
            );
        }

        return null;
    }

    private generateThumbnail(image: string): string {
        // A 'thumbnail' is really just an svg image with
        // the width and height forced to 100%
        const h = image.replace(RegExpValues.SvgHeightRegex, '$1100%\"');
        return h.replace(RegExpValues.SvgWidthRegex, '$1100%\"');
    }

    private changeCurrentValue = (value: Value) => {
        this.currentValue = {...value};
    }

    private changeTool = (tool: Tool) => {
        this.setState({tool});
    }

    private extractSize(image: string): ISize {
        let height = '100px';
        let width = '100px';

        // Try the tags that might have been added by the cell formatter
        const sizeTagMatch = RegExpValues.SvgSizeTagRegex.exec(image);
        if (sizeTagMatch && sizeTagMatch.length > 2) {
            width = sizeTagMatch[1];
            height = sizeTagMatch[2];
        } else {
            // Otherwise just parse the height/width directly
            const heightMatch = RegExpValues.SvgHeightRegex.exec(image);
            if (heightMatch && heightMatch.length > 2) {
                height = heightMatch[2];
            }
            const widthMatch = RegExpValues.SvgHeightRegex.exec(image);
            if (widthMatch && widthMatch.length > 2) {
                width = widthMatch[2];
            }
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

    private convertSizeToPixels(size: string) : number {
        let multiplier = 1;
        if (size.endsWith('pt')) {
            multiplier = window.devicePixelRatio * 0.8866666;
        }
        return parseInt(size, 10) * multiplier;
    }

    private exportCurrent = async () => {
        // In order to export, we need the png and the svg. Generate
        // a png by drawing to a canvas and then turning the canvas into a dataurl.
        if (this.container && this.container.current) {
            const doc = this.container.current.ownerDocument;
            if (doc) {
                const canvas = doc.createElement('canvas');
                if (canvas) {
                    canvas.width = this.convertSizeToPixels(this.state.sizes[this.state.currentImage].width);
                    canvas.height = this.convertSizeToPixels(this.state.sizes[this.state.currentImage].height);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const waitable = createDeferred();
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
                        const png = canvas.toDataURL('png');
                        canvas.remove();

                        // Send both our image and the png.
                        this.sendMessage(PlotViewerMessages.ExportPlot, { svg: this.state.images[this.state.currentImage], png });
                    }
                }
            }
        }
    }

    private copyCurrent = async () => {
        // Not supported at the moment.
    }

    private prevClicked = () => {
        this.changeCurrentImage(this.state.currentImage - 1);
    }

    private nextClicked = () => {
        this.changeCurrentImage(this.state.currentImage + 1);
    }

    private deleteClicked = () => {
        if (this.state.currentImage >= 0) {
            const oldCurrent = this.state.currentImage;
            const newCurrent = this.state.images.length > 1 ? this.state.currentImage : -1;

            this.setState({
                images: this.state.images.filter((_v, i) => i !== oldCurrent),
                sizes: this.state.sizes.filter((_v, i) => i !== oldCurrent),
                values: this.state.values.filter((_v, i) => i !== oldCurrent),
                thumbnails: this.state.thumbnails.filter((_v, i) => i !== oldCurrent),
                currentImage : newCurrent
            });

            // Tell the other side too as we don't want it sending this image again
            this.sendMessage(PlotViewerMessages.RemovePlot, oldCurrent);
        }
    }
}
