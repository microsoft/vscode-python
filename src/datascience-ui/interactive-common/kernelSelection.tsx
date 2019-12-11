// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { Image, ImageName } from '../react-common/image';
import { getLocString } from '../react-common/locReactSide';
import { IFont, IServerState } from './mainState';

export interface IKernelSelectionProps {
    baseTheme: string;
    font: IFont;
    kernel: IServerState;
    selectServer(): void;
    selectKernel(): void;
}

export class KernelSelection extends React.Component<IKernelSelectionProps> {
    constructor(prop: IKernelSelectionProps) {
        super(prop);
    }

    public render() {
        const dynamicFont: React.CSSProperties = {
            fontSize: this.props.font.size > 2 ? this.props.font.size - 2 : this.props.font.size,
            fontFamily: this.props.font.family
        };

        return (
            <div className='kernel-status' style={dynamicFont}>
                <div className='kernel-status-section' role='button'>
                    <div className='kernel-status-text'>
                        {getLocString('DataScience.jupyterServer', 'Jupyter Server')}: {this.props.kernel.localizedUri}
                    </div>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image kernel-status-icon' image={this.getIcon()} />
                </div>
                <div className='kernel-status-divider'/>
                <div className='kernel-status-section kernel-status-section-hoverable' onClick={this.props.selectKernel} role='button'>
                    {this.props.kernel.displayName}: {this.props.kernel.jupyterServerStatus}
                </div>
            </div>
        );
    }

    private getIcon(): ImageName {
        return this.props.kernel.localizedUri === getLocString('DataScience.noKernel', 'No Kernel') ? ImageName.JupyterServerDisconnected : ImageName.JupyterServerConnected;
    }
}
