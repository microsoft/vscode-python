// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';
import './imageButton.css';

interface IImageButtonProps {
    baseTheme: string;
    tooltip: string;
    disabled?: boolean;
    hidden?: boolean;
    className?: string;
    onClick?(event?: React.MouseEvent<HTMLButtonElement>): void;
    onMouseDown?(event?: React.MouseEvent<HTMLButtonElement>): void;
}

export class ImageButton extends React.Component<IImageButtonProps> {
    constructor(props: IImageButtonProps) {
        super(props);
    }

    public render() {
        const classNames = `image-button image-button-${this.props.baseTheme} ${this.props.hidden ? 'hide' : ''} ${this.props.className}`;
        const innerFilter = this.props.disabled ? 'image-button-inner-disabled-filter' : '';
        const ariaDisabled = this.props.disabled ? 'true' : 'false';

        return (
            <button
                role="button"
                aria-pressed="false"
                disabled={this.props.disabled}
                aria-disabled={ariaDisabled}
                title={this.props.tooltip}
                aria-label={this.props.tooltip}
                className={classNames}
                onClick={this.props.onClick}
                onMouseDown={this.props.onMouseDown}
            >
                <span className={innerFilter}>
                    <span className="image-button-child">{this.props.children}</span>
                </span>
            </button>
        );
    }
}
