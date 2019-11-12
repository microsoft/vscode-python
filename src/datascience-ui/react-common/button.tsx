// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';

interface IButtonProps {
    className: string;
    tooltip: string;
    disabled?: boolean;
    hidden?: boolean;
    onClick?(event?: React.MouseEvent<HTMLButtonElement>): void;
}

export class Button extends React.Component<IButtonProps> {
    constructor(props: IButtonProps) {
        super(props);
    }

    public render() {
        const innerFilter = this.props.disabled ? 'button-inner-disabled-filter' : '';
        const ariaDisabled = this.props.disabled ? 'true' : 'false';

        return (
            <button
                role="button"
                aria-pressed="false"
                disabled={this.props.disabled}
                aria-disabled={ariaDisabled}
                title={this.props.tooltip}
                aria-label={this.props.tooltip}
                className={this.props.className}
                onClick={this.props.onClick}
            >
                <span className={innerFilter}>{this.props.children}</span>
            </button>
        );
    }
}
