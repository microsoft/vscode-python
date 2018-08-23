// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as request from 'request';
import { IDownloadFileService } from './types';

// Simple wrapper for request to allow for the use of a proxy server being
// specified in the request options.
export class RequestWithProxy implements IDownloadFileService {
    constructor(private proxyUri: string) { }

    public get requestOptions(): request.CoreOptions | undefined {
        if (this.proxyUri && this.proxyUri.length > 0) {
            return {
                proxy: this.proxyUri
            };
        } else {
            return;
        }
    }

    public downloadFile(uri: string): request.Request {
        const requestOptions: request.CoreOptions | undefined = this.requestOptions;
        return request(uri, requestOptions);
    }
}
