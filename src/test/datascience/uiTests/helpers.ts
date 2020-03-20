// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import * as playwright from 'playwright';
import { IAsyncDisposable, IDisposable } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { WebServer } from './webBrowserPanel';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
export type WaitForMessageOptions = {
    /**
     * Timeout for waiting for message.
     * Defaults to 65_000ms.
     *
     * @type {number}
     */
    timeoutMs?: number;
    /**
     * Number of times the message should be received.
     * Defaults to 1.
     *
     * @type {number}
     */
    numberOfTimes?: number;
};

export class BaseWebUI implements IAsyncDisposable {
    /**
     * UI could take a while to update, could be slower on CI server.
     * (500ms is generally enough, but increasing to 3s to avoid flaky CI tests).
     */
    protected readonly waitTimeForUIToUpdate = 3_000;
    protected page?: playwright.Page;
    private readonly disposables: IDisposable[] = [];
    private readonly webServerPromise = createDeferred<WebServer>();
    private webServer?: WebServer;
    private browser?: playwright.ChromiumBrowser;
    public async dispose() {
        while (this.disposables.length) {
            this.disposables.shift()?.dispose();
        }
        await this.browser?.close();
        await this.page?.close();
    }
    public _setWebServer(webServer: WebServer) {
        this.webServer = webServer;
        this.webServerPromise.resolve(webServer);
    }
    public async waitUntilLoaded(): Promise<void> {
        await this.webServerPromise.promise.then(() =>
            this.waitForMessage(InteractiveWindowMessages.LoadAllCellsComplete)
        );
    }
    public async waitForMessage(message: string, options?: WaitForMessageOptions): Promise<void> {
        if (!this.webServer) {
            throw new Error('WebServer not yet started');
        }
        const timeoutMs = options && options.timeoutMs ? options.timeoutMs : undefined;
        const numberOfTimes = options && options.numberOfTimes ? options.numberOfTimes : 1;
        // Wait for the mounted web panel to send a message back to the data explorer
        const promise = createDeferred<void>();
        const timer = timeoutMs
            ? setTimeout(() => {
                  if (!promise.resolved) {
                      promise.reject(new Error(`Waiting for ${message} timed out`));
                  }
              }, timeoutMs)
            : undefined;
        let timesMessageReceived = 0;
        const dispatchedAction = `DISPATCHED_ACTION_${message}`;
        const disposable = this.webServer.onDidReceiveMessage(msg => {
            const messageType = msg.type;
            if (messageType !== message && messageType !== dispatchedAction) {
                return;
            }
            timesMessageReceived += 1;
            if (timesMessageReceived < numberOfTimes) {
                return;
            }
            if (timer) {
                clearTimeout(timer);
            }
            disposable.dispose();
            if (messageType === message) {
                promise.resolve();
            } else {
                // It could be a redux dispatched message.
                // Wait for 10ms, wait for other stuff to finish.
                // We can wait for 100ms or 1s. But thats too long.
                // The assumption is that currently we do not have any setTimeouts
                // in UI code that's in the magnitude of 100ms or more.
                // We do have a couple of setTimeout's, but they wait for 1ms, not 100ms.
                // 10ms more than sufficient for all the UI timeouts.
                setTimeout(() => promise.resolve(), 10);
            }
        });

        return promise.promise;
    }
    /**
     * Opens a browser an loads the webpage, effectively loading the UI.
     */
    public async loadUI(url: string) {
        // Configure to display browser while debugging.
        this.browser = await playwright.chromium.launch({ headless: true, devtools: false });
        await this.browser.newContext();
        this.page = await this.browser.newPage();
        await this.page.goto(url);
    }

    public async captureScreenshot(filePath: string): Promise<void> {
        if (!(await fs.pathExists(path.basename(filePath)))) {
            await fs.ensureDir(path.basename(filePath));
        }
        await this.page?.screenshot({ path: filePath });
        // tslint:disable-next-line: no-console
        console.info(`Screenshot captured in ${filePath}`);
    }
}
