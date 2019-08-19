// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';

import { IJupyterVariable } from '../../client/datascience/types';
import { Progress } from '../react-common/progress';
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
    refreshVariables(): void;
    variableExplorerToggled(open: boolean): void;
}

export class VariablePanel extends React.Component<IVariablePanelProps> {
    constructor(prop: IVariablePanelProps) {
        super(prop);
    }

    public render() {
        const progressBar = this.props.busy && !this.props.testMode ? <Progress /> : undefined;
        return(
                <div id='variable-panel'>
                    {progressBar}
                    <VariableExplorer
                        pendingVariableCount={this.props.pendingVariableCount}
                        variables={this.props.variables}
                        debugging={this.props.debugging}
                        baseTheme={this.props.baseTheme}
                        skipDefault={this.props.skipDefault}
                        showDataExplorer={this.props.showDataExplorer}
                        refreshVariables={this.props.refreshVariables}
                        variableExplorerToggled={this.props.variableExplorerToggled}/>
                    <div id='variable-divider'/>
                </div>
        );
    }
}
