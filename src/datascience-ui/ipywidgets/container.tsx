// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as React from 'react';
import { PostOffice } from '../react-common/postOffice';
import { WidgetManager } from './manager';

import 'bootstrap/dist/css/bootstrap.css';
import { Observable } from 'rxjs/Observable';
import { AllowedIPyWidgetMessages } from '../interactive-common/redux/postOffice';

type Props = {
    postOffice: PostOffice;
    widgetContainerId: string;
};

export class WidgetManagerComponent extends React.Component<Props> {
    private readonly widgetManager: WidgetManager;

    constructor(props: Props) {
        super(props);
        // tslint:disable-next-line: no-any
        const widgetMessages = new Observable<{ type: string; payload?: any }>((subscriber) => {
            this.props.postOffice.addHandler({
                // tslint:disable-next-line: no-any
                handleMessage(message: string, payload?: any): boolean {
                    // Double check this is one of our messages. React will actually post messages here too during development
                    if (AllowedIPyWidgetMessages.find((k) => k === message)) {
                        subscriber.next({ type: message, payload });
                    }
                    return true;
                }
            });
        });

        this.widgetManager = new WidgetManager(
            document.getElementById(this.props.widgetContainerId)!,
            widgetMessages,
            this.props.postOffice.sendMessage.bind(this.props.postOffice),
            this.props.postOffice
        );

        // Old working
        // tslint:disable-next-line: no-any
        // const widgetMessages = new ReplaySubject<{ type: string; payload?: any }>(1000);
        // this.props.postOffice.addHandler({
        //     // tslint:disable-next-line: no-any
        //     handleMessage(message: string, payload?: any): boolean {
        //         // Double check this is one of our messages. React will actually post messages here too during development
        //         if (AllowedIPyWidgetMessages.find((k) => k === message)) {
        //             widgetMessages.next({ type: message, payload });
        //         }
        //         return true;
        //     }
        // });

        // this.widgetManager = new WidgetManager(
        //     document.getElementById(this.props.widgetContainerId)!,
        //     widgetMessages.asObservable(),
        //     this.props.postOffice.sendMessage.bind(this.props.postOffice),
        //     this.props.postOffice
        // );
    }
    public render() {
        return null;
    }
    public componentWillUnmount() {
        this.widgetManager.dispose();
    }
}
