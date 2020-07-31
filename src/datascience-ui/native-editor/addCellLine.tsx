// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';

interface IAddCellLineProps {
    baseTheme: string;
    includePlus: boolean;
    className: string;
    isNotebookTrusted: boolean;
    click(): void;
}

export class AddCellLine extends React.Component<IAddCellLineProps> {
    constructor(props: IAddCellLineProps) {
        super(props);
    }

    public render() {
        const className = `add-cell-line ${this.props.className}`;
        const tooltip = getLocString('DataScience.insertBelow', 'Insert cell below');
        const plus = this.props.includePlus ? (
            <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.InsertBelow} />
        ) : null;
        const disabled = !this.props.isNotebookTrusted;
        const innerFilter = disabled ? 'image-button-inner-disabled-filter' : '';
        return (
            <div className={className}>
                <button
                    role="button"
                    aria-pressed="false"
                    title={tooltip}
                    disabled={disabled}
                    aria-label={tooltip}
                    className="add-cell-line-button"
                    onClick={this.props.click}
                >
                    <span className={innerFilter}>
                        {plus}
                        <span className="add-cell-line-divider" />
                    </span>
                </button>
            </div>
        );
    }
}
