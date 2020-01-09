// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';

interface ICollapseButtonProps {
    theme: string;
    tooltip: string;
    visible: boolean;
    open: boolean;
    label?: string;
    onClick(): void;
}

export class CollapseButton extends React.Component<ICollapseButtonProps> {
    constructor(props: ICollapseButtonProps) {
        super(props);
    }

    public render() {
        const collapseInputPolygonClassNames = `collapse-input-svg ${this.props.open ? ' collapse-input-svg-rotate' : ''} collapse-input-svg-${this.props.theme}`;
        const collapseInputClassNames = `collapse-input remove-style ${this.props.visible ? '' : ' invisible'}`;
        const tooltip = this.props.open ? getLocString('DataScience.collapseSingle', 'Collapse') : getLocString('DataScience.expandSingle', 'Expand');
        const ariaExpanded = this.props.open ? 'true' : 'false';
        // https://reactjs.org/docs/conditional-rendering.html#inline-if-with-logical--operator
        // Comment here just because the (boolean && statement) was new to me
        return (
            <button className={collapseInputClassNames} title={tooltip} onClick={this.props.onClick} aria-expanded={ariaExpanded}>
                <svg version="1.1" baseProfile="full" width="8px" height="11px">
                    <polygon points="0,0 0,10 5,5" className={collapseInputPolygonClassNames} fill="black" />
                </svg>
                {this.props.label && <label className="collapseInputLabel">{this.props.label}</label>}
            </button>
        );
    }
}
