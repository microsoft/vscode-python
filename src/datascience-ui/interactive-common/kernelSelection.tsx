// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IFont, IServerState, ServerStatus } from './mainState';

export interface IKernelSelectionProps {
    baseTheme: string;
    font: IFont;
    kernel: IServerState;
    selectServer(): void;
    selectKernel(): void;
}

export class KernelSelection extends React.Component<IKernelSelectionProps> {
    private get isKernelSelectionAllowed() {
        return (
            this.props.kernel.jupyterServerStatus !== ServerStatus.Restarting &&
            this.props.kernel.jupyterServerStatus !== ServerStatus.Starting
        );
    }
    constructor(prop: IKernelSelectionProps) {
        super(prop);
        this.selectKernel = this.selectKernel.bind(this);
    }

    public render() {
        const serverTextSize =
            getLocString('DataScience.jupyterServer', 'Jupyter Server').length +
            this.props.kernel.localizedUri.length +
            4; // plus 4 for the icon
        const displayNameTextSize = this.props.kernel.displayName.length + this.props.kernel.jupyterServerStatus.length;
        const dynamicFont: React.CSSProperties = {
            fontSize: 'var(--vscode-font-size)', // Use the same font and size as the menu
            fontFamily: 'var(--vscode-font-family)',
            maxWidth: this.getMaxWidth(serverTextSize + displayNameTextSize + 5) // plus 5 for the line and margins
        };
        const serverTextWidth: React.CSSProperties = {
            maxWidth: this.getMaxWidth(serverTextSize)
        };
        const displayNameTextWidth: React.CSSProperties = {
            maxWidth: this.getMaxWidth(displayNameTextSize)
        };

        return (
            <div className="kernel-status" style={dynamicFont}>
                <div className="kernel-status-section kernel-status-server" style={serverTextWidth} role="button">
                    <div className="kernel-status-text" title={this.props.kernel.localizedUri}>
                        {getLocString('DataScience.jupyterServer', 'Jupyter Server')}: {this.props.kernel.localizedUri}
                    </div>
                    <Image
                        baseTheme={this.props.baseTheme}
                        class="image-button-image kernel-status-icon"
                        image={this.getIcon()}
                    />
                </div>
                <div className="kernel-status-divider" />
                {this.renderKernelStatus(displayNameTextWidth)}
            </div>
        );
    }

    private renderKernelStatus(displayNameTextWidth: React.CSSProperties) {
        if (this.isKernelSelectionAllowed) {
            return (
                <div
                    className="kernel-status-section kernel-status-section-hoverable kernel-status-status"
                    style={displayNameTextWidth}
                    onClick={this.selectKernel}
                    role="button"
                >
                    {this.props.kernel.displayName}: {this.props.kernel.jupyterServerStatus}
                </div>
            );
        } else {
            const displayName = this.props.kernel.displayName ?? getLocString('DataScience.noKernel', 'No Kernel');
            return (
                <div className="kernel-status-section kernel-status-status" style={displayNameTextWidth} role="button">
                    {displayName}: {this.props.kernel.jupyterServerStatus}
                </div>
            );
        }
    }

    private selectKernel() {
        if (this.isKernelSelectionAllowed) {
            this.props.selectKernel();
        }
    }
    private getIcon(): ImageName {
        return this.props.kernel.jupyterServerStatus === ServerStatus.NotStarted
            ? ImageName.JupyterServerDisconnected
            : ImageName.JupyterServerConnected;
    }

    private getMaxWidth(charLength: number): string {
        // This comes from a linear regression
        const width = 0.57674 * charLength + 1.70473;
        const unit = 'em';
        return Math.round(width).toString() + unit;
    }
}
