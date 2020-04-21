// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import { sha256 } from 'hash.js';
import * as path from 'path';
import request from 'request';
import { Uri } from 'vscode';
import { traceError, traceInfo } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IConfigurationService, IHttpClient, WidgetCDNs } from '../../common/types';
import { createDeferred, sleep } from '../../common/utils/async';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { ILocalResourceUriConverter } from '../types';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from './types';

// Source borrowed from https://github.com/jupyter-widgets/ipywidgets/blob/54941b7a4b54036d089652d91b39f937bde6b6cd/packages/html-manager/src/libembed-amd.ts#L33
const unpgkUrl = 'https://unpkg.com/';
const jsdelivrUrl = 'https://cdn.jsdelivr.net/npm/';

// tslint:disable: no-var-requires no-require-imports
const sanitize = require('sanitize-filename');

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
    if (cdn === jsdelivrUrl) {
        // Js Delivr doesn't support ^ in the version. It needs an exact version
        if (moduleVersion.startsWith('^')) {
            moduleVersion = moduleVersion.slice(1);
        }
        // Js Delivr also needs the .js file on the end.
        if (!fileName.endsWith('.js')) {
            fileName = fileName.concat('.js');
        }
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
    private cache = new Map<string, WidgetScriptSource>();
    constructor(
        private readonly configurationSettings: IConfigurationService,
        private readonly httpClient: IHttpClient,
        private readonly localResourceUriConverter: ILocalResourceUriConverter,
        private readonly fileSystem: IFileSystem
    ) {}
    public dispose() {
        this.cache.clear();
    }
    public async getWidgetScriptSource(moduleName: string, moduleVersion: string): Promise<WidgetScriptSource> {
        // First see if we already have it downloaded.
        const key = this.getModuleKey(moduleName, moduleVersion);
        const diskPath = path.join(this.localResourceUriConverter.rootScriptFolder.fsPath, key, 'index.js');
        let cached = this.cache.get(key);

        // Might be on disk, try there first.
        if (!cached) {
            if (diskPath && (await this.fileSystem.fileExists(diskPath))) {
                const scriptUri = (await this.localResourceUriConverter.asWebviewUri(Uri.file(diskPath))).toString();
                cached = { moduleName, scriptUri, source: 'cdn' };
                this.cache.set(key, cached);
            }
        }

        // If still not found, download it.
        if (!cached) {
            // Make sure the disk path directory exists. We'll be downloading it to there.
            await this.fileSystem.createDirectory(path.dirname(diskPath));

            // Then get the first one that returns.
            const file = await this.downloadFastestCDN(moduleName, moduleVersion);
            try {
                if (file) {
                    // Need to copy from the temporary file to our real file (note: VSC filesystem fails to copy so just use straight file system)
                    await fs.copyFile(file.filePath, diskPath);

                    // Now we can generate the script URI so the local converter doesn't try to copy it.
                    const scriptUri = (
                        await this.localResourceUriConverter.asWebviewUri(Uri.file(diskPath))
                    ).toString();
                    cached = { moduleName, scriptUri, source: 'cdn' };
                } else {
                    cached = { moduleName };
                }
            } catch (exc) {
                traceError('Error downloading from CDN: ', exc);
                cached = { moduleName };
            } finally {
                if (file) {
                    file.dispose();
                }
            }
            this.cache.set(key, cached);
        }

        return cached;
    }

    private async downloadFastestCDN(moduleName: string, moduleVersion: string) {
        const deferred = createDeferred<TemporaryFile | undefined>();
        Promise.all(
            // For each CDN, try to download it.
            this.cdnProviders.map((cdn) =>
                this.downloadFromCDN(moduleName, moduleVersion, cdn).then((t) => {
                    // First one to get here wins.
                    if (!deferred.resolved && t) {
                        deferred.resolve(t);
                    }
                })
            )
        )
            .then((_a) => {
                // If still not resolved, then return empty
                if (!deferred.resolved) {
                    deferred.resolve(undefined);
                }
            })
            .ignoreErrors();
        return deferred.promise;
    }

    private async downloadFromCDN(
        moduleName: string,
        moduleVersion: string,
        cdn: WidgetCDNs
    ): Promise<TemporaryFile | undefined> {
        // First validate CDN
        const downloadUrl = await this.generateDownloadUri(moduleName, moduleVersion, cdn);
        if (downloadUrl) {
            // Then see if we can download the file.
            try {
                return await this.downloadFile(downloadUrl);
            } catch (exc) {
                // Something goes wrong, just fail
            }
        }
    }

    private async generateDownloadUri(
        moduleName: string,
        moduleVersion: string,
        cdn: WidgetCDNs
    ): Promise<string | undefined> {
        const cdnBaseUrl = getCDNPrefix(cdn);
        if (cdnBaseUrl) {
            // May have already been validated.
            const url = moduleNameToCDNUrl(cdnBaseUrl, moduleName, moduleVersion);
            if (CDNWidgetScriptSourceProvider.validUrls.has(url)) {
                return url;
            }

            // Try pinging first.
            const stopWatch = new StopWatch();
            const exists = await this.httpClient.exists(url);
            sendTelemetryEvent(Telemetry.DiscoverIPyWidgetNamesCDNPerf, stopWatch.elapsedTime, { cdn, exists });
            CDNWidgetScriptSourceProvider.validUrls.set(url, exists);
            return exists ? url : undefined;
        }
        return undefined;
    }

    private getModuleKey(moduleName: string, moduleVersion: string) {
        return sanitize(sha256().update(`${moduleName}${moduleVersion}`).digest('hex'));
    }

    private async downloadFile(downloadUrl: string | undefined): Promise<TemporaryFile | undefined> {
        // Download URL should not be undefined (we validated in a filter above)
        if (!downloadUrl) {
            throw new Error('Cannot download from an undefined CDN');
        }

        // Create a temp file to download the results to
        const tempFile = await this.fileSystem.createTemporaryFile('.js');

        // Otherwise do an http get on the url. Retry at least 5 times
        let retryCount = 5;
        let success = false;
        while (retryCount > 0 && !success) {
            let req: request.Request;
            try {
                req = await this.httpClient.downloadFile(downloadUrl);
            } catch (exc) {
                traceInfo(`Error downloading from ${downloadUrl}: `, exc);
                retryCount -= 1;

                // CDN may be busy, give it a break.
                await sleep(500);
                continue;
            }

            try {
                if (req) {
                    // Write to our temp file.
                    const tempWriteStream = this.fileSystem.createWriteStream(tempFile.filePath);
                    const deferred = createDeferred();
                    req.on('error', (e) => {
                        traceError(`Error downloading from CDN: `, e);
                        deferred.reject(e);
                    })
                        .pipe(tempWriteStream)
                        .on('close', () => {
                            deferred.resolve();
                        });
                    await deferred.promise;
                    success = true;
                }
            } catch (exc) {
                // Don't do anything if we fail to write it.
                traceError(`Error writing CDN download to disk: `, exc);
                break;
            }
        }

        // Once we make it out, return result
        if (success) {
            return tempFile;
        } else {
            tempFile.dispose();
        }
    }
}
