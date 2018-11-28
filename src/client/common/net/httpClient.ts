// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as requestTypes from 'request';
import { IHttpClient } from '../../activation/types';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';

@injectable()
export class HttpClient implements IHttpClient {
    public readonly requestOptions: requestTypes.CoreOptions;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.requestOptions = { proxy: workspaceService.getConfiguration('http').get('proxy', '') };
    }

    public async downloadFile(uri: string): Promise<requestTypes.Request> {
        // tslint:disable-next-line:no-any
        const request = await import('request') as any as typeof requestTypes;
        return request(uri, this.requestOptions);
    }
    public async getJSON<T>(uri: string): Promise<T> {
        // tslint:disable-next-line:no-require-imports
        const request = require('request') as typeof requestTypes;
        return new Promise<T>((resolve, reject) => {
            request(uri, this.requestOptions, (ex, response, body) => {
                if (ex) {
                    return reject(ex);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`));
                }
                resolve(JSON.parse(body) as T);
            });
        });
    }
}
