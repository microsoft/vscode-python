// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { traceWarning } from '../../common/logger';
import { IConfigurationService, IHttpClient, WidgetCDNs } from '../../common/types';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

// Source borrowed from https://github.com/jupyter-widgets/ipywidgets/blob/54941b7a4b54036d089652d91b39f937bde6b6cd/packages/html-manager/src/libembed-amd.ts#L33
const unpgkUrl = 'https://unpkg.com/';
const jsdelivrUrl = 'https://cdn.jsdelivr.net/npm/';
function moduleNameToCDNUrl(cdn: string, moduleName: string, moduleVersion: string) {
    let packageName = moduleName;
    let fileName = 'index'; // default filename
    // if a '/' is present, like 'foo/bar', packageName is changed to 'foo', and path to 'bar'
    // We first find the first '/'
    let index = moduleName.indexOf('/');
    if (index !== -1 && moduleName[0] === '@') {
        // if we have a namespace, it's a different story
        // @foo/bar/baz should translate to @foo/bar and baz
        // so we find the 2nd '/'
        index = moduleName.indexOf('/', index + 1);
    }
    if (index !== -1) {
        fileName = moduleName.substr(index + 1);
        packageName = moduleName.substr(0, index);
    }
    return `${cdn}${packageName}@${moduleVersion}/dist/${fileName}`;
}

function getCDNPrefix(cdn?: WidgetCDNs): string | undefined {
    switch (cdn) {
        case 'unpkg.com':
            return unpgkUrl;
        case 'jsdelivr.com':
            return jsdelivrUrl;
        default:
            break;
    }
}
/**
 * Widget scripts are found in CDN.
 * Given an widget module name & version, this will attempt to find the Url on a CDN.
 * We'll need to stick to the order of preference prescribed by the user.
 */
export class CDNWidgetScriptSourceProvider implements IWidgetScriptSourceProvider {
    private get cdnProviders(): readonly WidgetCDNs[] {
        const settings = this.configurationSettings.getSettings(undefined);
        return settings.datascience.widgetScriptSources;
    }
    public static validUrls = new Map<string, boolean>();
    constructor(
        private readonly configurationSettings: IConfigurationService,
        private readonly httpClient: IHttpClient
    ) {}
    public dispose() {
        // Noop.
    }
    public async getWidgetScriptSource(moduleName: string, moduleVersion: string): Promise<WidgetScriptSource> {
        const cdns = [...this.cdnProviders];
        while (cdns.length) {
            const cdn = cdns.shift();
            const cdnBaseUrl = getCDNPrefix(cdn);
            if (!cdnBaseUrl || !cdn) {
                continue;
            }
            const scriptUri = moduleNameToCDNUrl(cdnBaseUrl, moduleName, moduleVersion);
            const exists = await this.getUrlForWidget(cdn, scriptUri);
            if (exists) {
                return { moduleName, scriptUri, source: 'cdn' };
            }
        }
        traceWarning(`Widget Script not found for ${moduleName}@${moduleVersion}`);
        return { moduleName };
    }
    private async getUrlForWidget(cdn: string, url: string): Promise<boolean> {
        if (CDNWidgetScriptSourceProvider.validUrls.has(url)) {
            return CDNWidgetScriptSourceProvider.validUrls.get(url)!;
        }

        const stopWatch = new StopWatch();
        const exists = await this.httpClient.exists(url);
        sendTelemetryEvent(Telemetry.DiscoverIPyWidgetNamesCDNPerf, stopWatch.elapsedTime, { cdn, exists });
        CDNWidgetScriptSourceProvider.validUrls.set(url, exists);
        return exists;
    }
}
