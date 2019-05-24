// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variablePanel.css';

import * as React from 'react';

import { Progress } from '../react-common/progress';
import { VariableExplorer } from './variableExplorer';

export interface IVariablePanelProps {
    baseTheme: string;
    busy: boolean;
    testMode?: boolean;
    variableExplorerRef: React.RefObject<VariableExplorer>;
    showDataExplorer(targetVariable: string): void;
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
                    <VariableExplorer baseTheme={this.props.baseTheme}
                    showDataExplorer={this.props.showDataExplorer}
                    refreshVariables={this.props.refreshVariables}
                    variableExplorerToggled={this.props.variableExplorerToggled}
                    ref={this.props.variableExplorerRef} />
                    <div id='variable-divider'/>
                </div>
        );
    }
}
