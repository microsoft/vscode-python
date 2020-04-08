// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as isonline from 'is-online';
import * as React from 'react';
import { Store } from 'redux';
import { IStore } from '../interactive-common/redux/store';
import { PostOffice } from '../react-common/postOffice';
import { WidgetManager } from './manager';

import { SharedMessages } from '../../client/datascience/messages';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import {
    CommonAction,
    CommonActionType,
    ILoadIPyWidgetClassFailureAction,
    LoadIPyWidgetClassDisabledAction,
    LoadIPyWidgetClassLoadAction
} from '../interactive-common/redux/reducers/types';

type Props = {
    postOffice: PostOffice;
    widgetContainerId: string;
    store: Store<IStore> & { dispatch: unknown };
};

export class WidgetManagerComponent extends React.Component<Props> {
    private readonly widgetManager: WidgetManager;
    private readonly loaderSettings = {
        loadWidgetScriptsFromThirdPartySource: false,
        errorHandler: this.handleLoadError.bind(this),
        successHandler: this.handleLoadSuccess.bind(this)
    };
    constructor(props: Props) {
        super(props);
        this.loaderSettings.loadWidgetScriptsFromThirdPartySource =
            props.store.getState().main.settings?.loadWidgetScriptsFromThirdPartySource === true;

        this.widgetManager = new WidgetManager(
            document.getElementById(this.props.widgetContainerId)!,
            this.props.postOffice,
            this.loaderSettings
        );

        props.postOffice.addHandler({
            // tslint:disable-next-line: no-any
            handleMessage: (type: string, payload?: any) => {
                if (type === SharedMessages.UpdateSettings) {
                    const settings = JSON.parse(payload) as IDataScienceExtraSettings;
                    this.loaderSettings.loadWidgetScriptsFromThirdPartySource =
                        settings.loadWidgetScriptsFromThirdPartySource === true;
                }
                return true;
            }
        });
    }
    public render() {
        return null;
    }
    public componentWillUnmount() {
        this.widgetManager.dispose();
    }

    private createLoadSuccessAction(
        className: string,
        moduleName: string,
        moduleVersion: string
    ): CommonAction<LoadIPyWidgetClassLoadAction> {
        return {
            type: CommonActionType.LOAD_IPYWIDGET_CLASS_SUCCESS,
            payload: { messageDirection: 'incoming', data: { className, moduleName, moduleVersion } }
        };
    }

    private createLoadErrorAction(
        className: string,
        moduleName: string,
        moduleVersion: string,
        isOnline: boolean,
        // tslint:disable-next-line: no-any
        error: any
    ): CommonAction<ILoadIPyWidgetClassFailureAction> {
        return {
            type: CommonActionType.LOAD_IPYWIDGET_CLASS_FAILURE,
            payload: { messageDirection: 'incoming', data: { className, moduleName, moduleVersion, isOnline, error } }
        };
    }
    private createLoadDisabledErrorAction(
        className: string,
        moduleName: string,
        moduleVersion: string
    ): CommonAction<LoadIPyWidgetClassDisabledAction> {
        return {
            type: CommonActionType.LOAD_IPYWIDGET_CLASS_DISABLED_FAILURE,
            payload: { messageDirection: 'incoming', data: { className, moduleName, moduleVersion } }
        };
    }

    // tslint:disable-next-line: no-any
    private async handleLoadError(className: string, moduleName: string, moduleVersion: string, error: any) {
        if (this.loaderSettings.loadWidgetScriptsFromThirdPartySource) {
            const isOnline = await isonline.default({ timeout: 1000 });
            this.props.store.dispatch(
                this.createLoadErrorAction(className, moduleName, moduleVersion, isOnline, error)
            );
        } else {
            this.props.store.dispatch(this.createLoadDisabledErrorAction(className, moduleName, moduleVersion));
        }
    }

    private handleLoadSuccess(className: string, moduleName: string, moduleVersion: string) {
        this.props.store.dispatch(this.createLoadSuccessAction(className, moduleName, moduleVersion));
    }
}
