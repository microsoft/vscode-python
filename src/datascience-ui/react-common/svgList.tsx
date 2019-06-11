// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { SvgLoader } from 'react-svgmt';

import './svgList.css';

interface ISvgListProps {
    images: string[];
    currentImage: number;
    imageClicked(index: number): void;
}

export class SvgList extends React.Component<ISvgListProps> {
    constructor(props: ISvgListProps) {
        super(props);
    }

    public render() {
        return (
            <div className='svg-list-container'>
                <div className='svg-list'>
                {this.renderImages()}
                </div>
            </div>
        );
    }

    private renderImages() {
        return this.props.images.map((image, index) => {
            const className = index === this.props.currentImage ? 'svg-list-item svg-list-item-selected' : 'svg-list-item';
            const clickHandler = () => this.props.imageClicked(index);
            return (
                // See the comments here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
                // tslint:disable-next-line: react-this-binding-issue
                <div className={className} role='button' onClick={clickHandler} key={index}>
                    <div className='svg-list-item-image'>
                        <SvgLoader svgXML={image}>
                        </SvgLoader>
                    </div>
                </div>
            );
        });
    }
}
