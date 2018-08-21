// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as request from 'request';
import { IDownloadFileService } from './types';

// Simple wrapper for request to allow for the use of a proxy server being
// specified in the request options.
export class RequestWithProxy implements IDownloadFileService {
    constructor(private proxyUri: string) { }

    public getRequestOptions(): request.CoreOptions | undefined {
        if (this.proxyUri && this.proxyUri.length > 0) {
            return {
                proxy: this.proxyUri
            };
        }
        return;
    }

    public downloadFile(uri: string): request.Request {
        const requestOptions = this.getRequestOptions();
        if (requestOptions) {
            return request(uri, requestOptions);
        }
        return request(uri);
    }
}
