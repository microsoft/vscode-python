// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';

import './reactSlickGridFilterBox.css';

interface IFilterProps {
    column: Slick.Column<Slick.SlickData>;
    onChange(val: string, column: Slick.Column<Slick.SlickData>): void;
}

export class ReactSlickGridFilterBox extends React.Component<IFilterProps> {
    constructor(props: IFilterProps) {
        super(props);
    }

    public render() {
        return <input type="text" tabIndex={0} aria-label={this.props.column.name} className="filter-box" onChange={this.updateInputValue} />;
    }

    private updateInputValue = (evt: React.SyntheticEvent) => {
        const element = evt.currentTarget as HTMLInputElement;
        if (element) {
            this.props.onChange(element.value, this.props.column);
        }
    };
}
