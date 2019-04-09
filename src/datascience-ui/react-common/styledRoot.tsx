// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';

import { CssMessages, IGetCssResponse, SharedMessages } from '../../client/datascience/constants';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from './postOffice';

export interface IStyledRootProps {
    isDark: boolean;
}

interface IStyledRootState {
    rootCss?: string;
    theme?: string;
}

export class StyledRoot extends React.Component<IStyledRootProps, IStyledRootState> implements IMessageHandler {

    constructor(props: IStyledRootProps) {
        super(props);
        this.state = { rootCss: undefined, theme: undefined };
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        PostOffice.addHandler(this);
    }

    public componentWillUnmount() {
        // Remove ourselves as a handler for the post office
        PostOffice.removeHandler(this);
    }

    public componentDidMount() {
        if (!this.state.rootCss) {
            window.console.log('Generating css');
            // Set to a temporary value.
            this.setState({rootCss: ' '});
            PostOffice.sendUnsafeMessage(CssMessages.GetCssRequest, { isDark: this.props.isDark });
        }
    }

    public updateStyle(css: string, theme: string) {
        if (this.state.theme !== theme) {
            this.setState({rootCss: css, theme});
        }
    }

    public render() {
        return (
            <div className='styleSetter'>
                <style>
                    {this.state.rootCss}
                </style>
                {this.props.children}
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) : boolean => {
        switch (msg) {
            case CssMessages.GetCssResponse:
                this.handleResponse(payload);
                break;

            case SharedMessages.UpdateSettings:
                this.updateSettings(payload);
                break;

            default:
                break;
        }

        return true;
    }

    // tslint:disable-next-line:no-any
    private handleResponse(payload?: any) {
        const response = payload as IGetCssResponse;
        if (response && response.css) {
            this.setState({
                rootCss: response.css,
                theme: response.theme
            });
        }
    }

    // tslint:disable-next-line:no-any
    private updateSettings(payload: any) {
        if (payload) {
            const newSettings = JSON.parse(payload as string);
            const dsSettings = newSettings as IDataScienceExtraSettings;
            if (dsSettings && dsSettings.extraSettings && dsSettings.extraSettings.theme !== this.state.theme) {
                // User changed the current theme. Rerender
                PostOffice.sendUnsafeMessage(CssMessages.GetCssRequest, { isDark: this.props.isDark });
            }
        }
    }
}
