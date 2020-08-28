// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { isEmpty, isNil } from 'lodash';
import * as React from 'react';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IFont, IServerState, ServerStatus } from './mainState';
import { TrustMessage } from './trustMessage';
import { getMaxWidth } from './utils';

export interface IJupyterInfoProps {
    baseTheme: string;
    font: IFont;
    kernel: IServerState;
    isNotebookTrusted?: boolean;
    shouldShowTrustMessage: boolean;
    settings?: IDataScienceExtraSettings | undefined;
    selectServer(): void;
    launchNotebookTrustPrompt?(): void; // Native editor-specific
    selectKernel(): void;
}

export class JupyterInfo extends React.Component<IJupyterInfoProps> {
    private get isKernelSelectionAllowed() {
        return (
            this.props.isNotebookTrusted !== false &&
            this.props.kernel.jupyterServerStatus !== ServerStatus.Restarting &&
            this.props.kernel.jupyterServerStatus !== ServerStatus.Starting
        );
    }
    constructor(prop: IJupyterInfoProps) {
        super(prop);
        this.selectKernel = this.selectKernel.bind(this);
        this.selectServer = this.selectServer.bind(this);
    }

    public render() {
        let jupyterServerDisplayName: string = this.props.kernel.localizedUri;
        if (!isNil(this.props.settings) && isEmpty(jupyterServerDisplayName)) {
            const jupyterServerUriSetting: string = this.props.settings.jupyterServerURI;
            if (!isEmpty(jupyterServerUriSetting) && this.isUriOfComputeInstance(jupyterServerUriSetting)) {
                jupyterServerDisplayName = this.getComputeInstanceNameFromId(jupyterServerUriSetting);
            }
        }

        const serverTextSize =
            getLocString('DataScience.jupyterServer', 'Jupyter Server').length + jupyterServerDisplayName.length + 4; // plus 4 for the icon
        const displayNameTextSize = this.props.kernel.displayName.length + this.props.kernel.jupyterServerStatus.length;
        const dynamicFont: React.CSSProperties = {
            fontSize: 'var(--vscode-font-size)', // Use the same font and size as the menu
            fontFamily: 'var(--vscode-font-family)',
            maxWidth: getMaxWidth(serverTextSize + displayNameTextSize + 5) // plus 5 for the line and margins
        };
        const serverTextWidth: React.CSSProperties = {
            maxWidth: getMaxWidth(serverTextSize)
        };
        const displayNameTextWidth: React.CSSProperties = {
            maxWidth: getMaxWidth(displayNameTextSize)
        };

        const ariaDisabled = this.props.isNotebookTrusted === undefined ? false : this.props.isNotebookTrusted;
        return (
            <div className="kernel-status" style={dynamicFont}>
                {this.renderTrustMessage()}
                <div className="kernel-status-section kernel-status-server" style={serverTextWidth}>
                    <div
                        className="kernel-status-text kernel-status-section-hoverable"
                        style={serverTextWidth}
                        onClick={this.selectServer}
                        role="button"
                        aria-disabled={ariaDisabled}
                    >
                        {getLocString('DataScience.jupyterServer', 'Jupyter Server')}: {jupyterServerDisplayName}
                    </div>
                    <Image
                        baseTheme={this.props.baseTheme}
                        class="image-button-image kernel-status-icon"
                        image={this.getIcon()}
                        title={this.getStatus()}
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
            return (
                <TrustMessage
                    shouldShowTrustMessage={this.props.shouldShowTrustMessage}
                    isNotebookTrusted={this.props.isNotebookTrusted}
                    launchNotebookTrustPrompt={this.props.launchNotebookTrustPrompt}
                />
            );
        }
    }

    private selectKernel() {
        this.props.selectKernel();
    }
    private getIcon(): ImageName {
        return this.props.kernel.jupyterServerStatus === ServerStatus.NotStarted
            ? ImageName.JupyterServerDisconnected
            : ImageName.JupyterServerConnected;
    }

    private getStatus() {
        return this.props.kernel.jupyterServerStatus === ServerStatus.NotStarted
            ? getLocString('DataScience.disconnected', 'Disconnected')
            : getLocString('DataScience.connected', 'Connected');
    }

    private isUriOfComputeInstance(uri: string): boolean {
        try {
            const parsedUrl: URL = new URL(uri);
            return parsedUrl.searchParams.get('id') === 'azureml_compute_instances';
        } catch (e) {
            return false;
        }
    }

    private getComputeInstanceNameFromId(id: string | undefined): string {
        if (isNil(id)) {
            return '';
        }

        const res: string[] | null = id.match(
            /\/providers\/Microsoft.MachineLearningServices\/workspaces\/[^\/]+\/computes\/([^\/]+)(\/)?/
        );
        if (isNil(res) || res.length < 2) {
            return '';
        }

        return res[1];
    }

    private selectServer(): void {
        this.props.selectServer();
    }
}
