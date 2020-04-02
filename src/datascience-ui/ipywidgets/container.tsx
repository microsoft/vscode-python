// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as isonline from 'is-online';
import * as React from 'react';
import { Store } from 'redux';
import { IStore } from '../interactive-common/redux/store';
import { PostOffice } from '../react-common/postOffice';
import { WidgetManager } from './manager';

import {
    CommonAction,
    CommonActionType,
    ILoadIPyWidgetClassFailureAction
} from '../interactive-common/redux/reducers/types';

type Props = {
    postOffice: PostOffice;
    widgetContainerId: string;
    store: Store<IStore> & { dispatch: unknown };
};

export class WidgetManagerComponent extends React.Component<Props> {
    private readonly widgetManager: WidgetManager;

    constructor(props: Props) {
        super(props);

        this.widgetManager = new WidgetManager(
            document.getElementById(this.props.widgetContainerId)!,
            this.props.postOffice,
            this.handleLoadError.bind(this)
        );
    }
    public render() {
        return null;
    }
    public componentWillUnmount() {
        this.widgetManager.dispose();
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

    // tslint:disable-next-line: no-any
    private async handleLoadError(className: string, moduleName: string, moduleVersion: string, error: any) {
        const isOnline = await isonline.default({ timeout: 1000 });
        this.props.store.dispatch(this.createLoadErrorAction(className, moduleName, moduleVersion, isOnline, error));
    }
}
