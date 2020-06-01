// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import type { JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import { concatMultilineStringOutput } from '../common';
import { fixLatexEquations } from '../interactive-common/latexManipulation';
import { getTransform } from '../interactive-common/transforms';

export interface ICellOutputProps {
    output: nbformat.IOutput;
    mimeType: string;
}

export class CellOutput extends React.Component<ICellOutputProps> {
    // tslint:disable-next-line: no-any
    constructor(prop: ICellOutputProps) {
        super(prop);
    }
    public render() {
        const mimeBundle = this.props.output.data as nbformat.IMimeBundle; // NOSONAR
        let data: nbformat.MultilineString | JSONObject = mimeBundle[this.props.mimeType!];

        // Fixup latex to make sure it has the requisite $$ around it
        if (this.props.mimeType! === 'text/latex') {
            data = fixLatexEquations(concatMultilineStringOutput(data as nbformat.MultilineString), true);
        }

        const Transform = getTransform(this.props.mimeType!);
        return (
            <div>
                <Transform data={data} />
            </div>
        );
    }
}
