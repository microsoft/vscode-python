// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as React from 'react';
import { PostOffice } from '../react-common/postOffice';
import { WidgetManager } from './manager';

import 'bootstrap/dist/css/bootstrap.css';

type Props = {
    postOffice: PostOffice;
    widgetContainerId: string;
};

export class WidgetManagerComponent extends React.Component<Props> {
    private readonly widgetManager: WidgetManager;

    constructor(props: Props) {
        super(props);

        this.widgetManager = new WidgetManager(
            document.getElementById(this.props.widgetContainerId)!,
            this.props.postOffice
        );
    }
    public render() {
        return null;
    }
    public componentWillUnmount() {
        this.widgetManager.dispose();
    }
}
