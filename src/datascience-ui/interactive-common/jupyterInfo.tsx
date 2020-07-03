// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IFont, IServerState, ServerStatus } from './mainState';

export interface IJupyterInfoProps {
    baseTheme: string;
    font: IFont;
    kernel: IServerState;
    isNotebookTrusted?: boolean;
    shouldShowTrustMessage: boolean;
    selectServer(): void;
    launchNotebookTrustPrompt?(): void; // Native editor-specific
    selectKernel(): void;
}

export class JupyterInfo extends React.Component<IJupyterInfoProps> {
    private get isKernelSelectionAllowed() {
        return (
            this.props.kernel.jupyterServerStatus !== ServerStatus.Restarting &&
            this.props.kernel.jupyterServerStatus !== ServerStatus.Starting
        );
    }
    constructor(prop: IJupyterInfoProps) {
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
                {this.renderTrustMessage()}
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
        const ariaDisabled = this.props.isNotebookTrusted === undefined ? false : this.props.isNotebookTrusted;
        if (this.isKernelSelectionAllowed) {
            return (
                <div
                    className="kernel-status-section kernel-status-section-hoverable kernel-status-status"
                    style={displayNameTextWidth}
                    onClick={this.selectKernel}
                    role="button"
                    aria-disabled={ariaDisabled}
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

    private renderTrustMessage() {
        if (this.props.shouldShowTrustMessage) {
            const text = this.props.isNotebookTrusted
                ? getLocString('DataScience.notebookIsTrusted', 'Trusted')
                : getLocString('DataScience.notebookIsNotTrusted', 'Not Trusted');
            const textSize = text.length;
            const dynamicFont: React.CSSProperties = {
                fontSize: 'var(--vscode-font-size)', // Use the same font and size as the menu
                fontFamily: 'var(--vscode-font-family)',
                maxWidth: this.getMaxWidth(textSize + 5), // plus 5 for the line and margins,
                color: this.props.isNotebookTrusted ? undefined : 'var(--vscode-editorError-foreground)'
            };
            const trustTextWidth: React.CSSProperties = {
                maxWidth: this.getMaxWidth(textSize)
            };

            return (
                <div className="kernel-status" style={dynamicFont}>
                    <div
                        className="kernel-status-section kernel-status-section-hoverable kernel-status-status"
                        style={trustTextWidth}
                        onClick={this.props.launchNotebookTrustPrompt}
                        role="button"
                    >
                        <div className="kernel-status-text">{text}</div>
                    </div>
                    <div className="kernel-status-divider" />
                </div>
            );
        }
    }

    private selectKernel() {
        if (this.props.isNotebookTrusted) {
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
