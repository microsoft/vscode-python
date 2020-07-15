// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import type { JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import { concatMultilineStringOutput } from '../common';
import { fixMarkdown } from '../interactive-common/markdownManipulation';
import { getTransform } from '../interactive-common/transforms';

export interface ICellOutputProps {
    output: nbformat.IExecuteResult | nbformat.IDisplayData;
    mimeType: string;
}

export class CellOutput extends React.Component<ICellOutputProps> {
    constructor(prop: ICellOutputProps) {
        super(prop);
    }
    public render() {
        const mimeBundle = this.props.output.data;
        const data: nbformat.MultilineString | JSONObject = mimeBundle[this.props.mimeType!];

        switch (this.props.mimeType) {
            case 'text/latex':
                return this.renderLatex(data);
            case 'image/png':
            case 'image/jpeg':
                return this.renderImage(mimeBundle, this.props.output.metadata);

            default:
                return this.renderLatex(data);
        }
    }
    /**
     * Custom rendering of image/png and image/jpeg to handle custom Jupyter metadata.
     * Behavior adopted from Jupyter lab.
     */
    // tslint:disable-next-line: no-any
    private renderImage(mimeBundle: nbformat.IMimeBundle, metadata: Record<string, any> = {}) {
        const mimeType = 'image/png' in mimeBundle ? 'image/png' : 'image/jpeg';

        const imgStyle: Record<string, string | number> = {};
        const divStyle: Record<string, string | number> = { overflow: 'scroll' }; // This is the default style used by Jupyter lab.
        const imgSrc = `data:${mimeType};base64,${mimeBundle[mimeType]}`;

        if (typeof metadata.needs_background === 'string') {
            divStyle.backgroundColor = metadata.needs_background === 'light' ? 'white' : 'black';
        }
        // tslint:disable-next-line: no-any
        const imageMetadata = metadata[mimeType] as Record<string, any> | undefined;
        if (imageMetadata) {
            if (imageMetadata.height) {
                imgStyle.height = imageMetadata.height;
            }
            if (imageMetadata.width) {
                imgStyle.width = imageMetadata.width;
            }
            if (imageMetadata.unconfined === true) {
                imgStyle.maxWidth = 'none';
            }
        }

        // Hack, use same classes as used in VSCode for images (keep things as similar as possible).
        // This is to maintain consistently in displaying images (if we hadn't used HTML).
        // See src/vs/workbench/contrib/notebook/browser/view/output/transforms/richTransform.ts
        // tslint:disable: react-a11y-img-has-alt
        return (
            <div className={'display'} style={divStyle}>
                <img src={imgSrc} style={imgStyle}></img>
            </div>
        );
    }
    private renderOutput(data: nbformat.MultilineString | JSONObject) {
        const Transform = getTransform(this.props.mimeType!);
        return (
            <div>
                <Transform data={data} />
            </div>
        );
    }
    private renderLatex(data: nbformat.MultilineString | JSONObject) {
        // Fixup latex to make sure it has the requisite $$ around it
        data = fixMarkdown(concatMultilineStringOutput(data as nbformat.MultilineString), true);
        return this.renderOutput(data);
    }
}
