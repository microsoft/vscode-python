// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './flyout.css';

import * as React from 'react';

interface IFlyoutProps {
    buttonClassName: string;
    flyoutContainerName: string;
    buttonContent: JSX.Element;
    buttonTooltip?: string;
    disabled?: boolean;
    hidden?: boolean;
}

interface IFlyoutState {
    visible: boolean;
}

export class Flyout extends React.Component<IFlyoutProps, IFlyoutState> {
    constructor(props: IFlyoutProps) {
        super(props);
        this.state = { visible: false };
    }

    public render() {
        const innerFilter = this.props.disabled ? 'flyout-inner-disabled-filter' : '';
        const ariaDisabled = this.props.disabled ? 'true' : 'false';
        const buttonClassName = this.props.buttonClassName;
        const flyoutClassName = this.state.visible
            ? `flyout-children-visible ${this.props.flyoutContainerName}`
            : `flyout-children-hidden ${this.props.flyoutContainerName}`;

        return (
            <div className="flyout-container" onMouseLeave={this.mouseLeave}>
                <button
                    role="button"
                    aria-pressed="false"
                    disabled={this.props.disabled}
                    aria-disabled={ariaDisabled}
                    title={this.props.buttonTooltip}
                    aria-label={this.props.buttonTooltip}
                    onMouseEnter={this.mouseEnter}
                    className={buttonClassName}
                >
                    <span className={innerFilter}>{this.props.buttonContent}</span>
                </button>
                <div className={flyoutClassName}>{this.props.children}</div>
            </div>
        );
    }

    private mouseEnter = () => {
        this.setState({ visible: true });
    };

    private mouseLeave = () => {
        this.setState({ visible: false });
    };
}
