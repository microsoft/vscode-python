// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variablePanel.css';

import * as React from 'react';

import { VariableExplorer } from './variableExplorer';

export interface IVariablePanelProps {
    baseTheme: string;
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
        return(
                <div id='variable-panel'>
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
