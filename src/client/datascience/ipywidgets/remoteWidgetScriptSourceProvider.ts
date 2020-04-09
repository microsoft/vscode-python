// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { traceWarning } from '../../common/logger';
import { IHttpClient } from '../../common/types';
import { IConnection } from '../types';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

/**
 * When using a remote jupyter connection the widget scripts are accessible over
 * `<remote url>/nbextensions/moduleName/index`
 */
export class RemoteWidgetScriptSourceProvider implements IWidgetScriptSourceProvider {
    public static validUrls = new Map<string, boolean>();
    constructor(private readonly connection: IConnection, private readonly httpClient: IHttpClient) {}
    public dispose() {
        // Noop.
    }
    public async getWidgetScriptSource(moduleName: string, moduleVersion: string): Promise<WidgetScriptSource> {
        const scriptUri = `${this.connection.baseUrl}nbextensions/${moduleName}/index`;
        const exists = await this.getUrlForWidget(`${scriptUri}.js`);
        if (exists) {
            return { moduleName, scriptUri, source: 'cdn' };
        }
        traceWarning(`Widget Script not found for ${moduleName}@${moduleVersion}`);
        return { moduleName };
    }
    private async getUrlForWidget(url: string): Promise<boolean> {
        if (RemoteWidgetScriptSourceProvider.validUrls.has(url)) {
            return RemoteWidgetScriptSourceProvider.validUrls.get(url)!;
        }

        const exists = await this.httpClient.exists(url);
        RemoteWidgetScriptSourceProvider.validUrls.set(url, exists);
        return exists;
    }
}
