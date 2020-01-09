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
            this.props.kernel.jupyterServerStatus !== ServerStatus.NotStarted &&
            this.props.kernel.jupyterServerStatus !== ServerStatus.Restarting &&
            this.props.kernel.jupyterServerStatus !== ServerStatus.Starting
        );
    }
    constructor(prop: IKernelSelectionProps) {
        super(prop);
        this.selectKernel = this.selectKernel.bind(this);
    }

    public render() {
        const dynamicFont: React.CSSProperties = {
            fontSize: this.props.font.size > 2 ? this.props.font.size - 2 : this.props.font.size,
            fontFamily: this.props.font.family
        };
        const kernelSelectionClass = this.isKernelSelectionAllowed
            ? 'kernel-status-section kernel-status-section-hoverable kernel-status-status'
            : 'kernel-status-section kernel-status-status';
        return (
            <div className="kernel-status" style={dynamicFont}>
                <div className="kernel-status-section kernel-status-server" role="button">
                    <div className="kernel-status-text" title={this.props.kernel.localizedUri}>
                        {getLocString('DataScience.jupyterServer', 'Jupyter Server')}: {this.props.kernel.localizedUri}
                    </div>
                    <Image baseTheme={this.props.baseTheme} class="image-button-image kernel-status-icon" image={this.getIcon()} />
                </div>
                <div className="kernel-status-divider" />
                <div className={kernelSelectionClass} onClick={this.selectKernel} role="button">
                    {this.props.kernel.displayName}: {this.props.kernel.jupyterServerStatus}
                </div>
            </div>
        );
    }
    private selectKernel() {
        if (this.isKernelSelectionAllowed) {
            this.props.selectKernel();
        }
    }
    private getIcon(): ImageName {
        return this.props.kernel.localizedUri === getLocString('DataScience.noKernel', 'No Kernel') ? ImageName.JupyterServerDisconnected : ImageName.JupyterServerConnected;
    }
}
