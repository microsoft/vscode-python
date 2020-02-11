// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';

import { noop } from '../../common/utils/misc';
import { IInteractiveWindowListener, IPlotViewerProvider } from '../types';
import { InteractiveWindowMessages } from './interactiveWindowTypes';

// tslint:disable: no-any
@injectable()
export class ShowPlotListener implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    constructor(@inject(IPlotViewerProvider) private provider: IPlotViewerProvider) {
        noop();
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.ShowPlot:
                if (payload) {
                    this.provider.showPlot(payload).ignoreErrors();
                    break;
                }
                break;
            default:
                break;
        }
    }
    public dispose(): void | undefined {
        noop();
    }
}
