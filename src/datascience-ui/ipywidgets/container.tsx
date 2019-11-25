// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as React from 'react';
import { connect } from 'react-redux';
import { Observable } from 'rxjs/Observable';
import { IInteractiveWindowMapping } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IStore } from '../interactive-common/redux/store';
import { WidgetManager } from './manager';

// tslint:disable-next-line: no-any
type Props = { messages: Observable<{type: string; payload?: any}>; sendMessage<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]): void };

function mapStateToProps(state: IStore): Props {
    return { messages: state.widgetMessagses, sendMessage: state.sendMessage } ;
}
// Default dispatcher (not required, but required for strictness).
function mapDispatchToProps(dispatch: Function) {
    return {dispatch};
}

class Container extends React.Component<Props> {
    private readonly widgetManager: WidgetManager;

    constructor(props: Props) {
        super(props);
        this.widgetManager = new WidgetManager(document.getElementById('rootWidget')!, props.messages, props.sendMessage);
    }
    public render() {
        return null;
    }
    public componentWillUnmount(){
        this.widgetManager.dispose();
    }
}

export const WidgetManagerComponent = connect(mapStateToProps, mapDispatchToProps)(Container);
