// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';

import { IJupyterVariable } from '../../client/datascience/types';
import { VariableExplorer } from './variableExplorer';

import './variablePanel.css';
export interface IVariablePanelProps {
    baseTheme: string;
    busy: boolean;
    skipDefault?: boolean;
    testMode?: boolean;
    variables: IJupyterVariable[];
    pendingVariableCount: number;
    debugging: boolean;
    showDataExplorer(targetVariable: string, numberOfColumns: number): void;
    closeVariableExplorer(): void;
}

export class VariablePanel extends React.Component<IVariablePanelProps> {
    constructor(prop: IVariablePanelProps) {
        super(prop);
    }

    public render() {
        return (
            <div id="variable-panel">
                <div id="variable-panel-padding">
                    <VariableExplorer
                        pendingVariableCount={this.props.pendingVariableCount}
                        variables={this.props.variables}
                        debugging={this.props.debugging}
                        baseTheme={this.props.baseTheme}
                        skipDefault={this.props.skipDefault}
                        showDataExplorer={this.props.showDataExplorer}
                        closeVariableExplorer={this.props.closeVariableExplorer}
                    />
                </div>
                <div id="variable-divider" />
            </div>
        );
    }
}
