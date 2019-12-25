// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Event } from 'vscode';
import * as vsls from 'vsls/vscode';

// tslint:disable:no-any unified-signatures
export class ServiceProxy implements vsls.SharedService {
    constructor(
        private realService : vsls.SharedService,
        private guestsResponding: () => Promise<boolean>,
        private forceShutdown: () => void
        ) {
    }
    public get isServiceAvailable(): boolean {
        return this.realService.isServiceAvailable;
    }
    public get onDidChangeIsServiceAvailable(): Event<boolean> {
        return this.realService.onDidChangeIsServiceAvailable;
    }

    public onRequest(name: string, handler: vsls.RequestHandler): void {
        return this.realService.onRequest(name, handler);
    }
    public onNotify(name: string, handler: vsls.NotifyHandler): void {
        return this.realService.onNotify(name, handler);
    }
    public async notify(name: string, args: object): Promise<void> {
        if (await this.guestsResponding()) {
            return this.realService.notify(name, args);
        } else {
            this.forceShutdown();
        }
    }
}
