// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as nodeFetch from 'node-fetch';

// Function for creating node Request object that prevents jupyterlab services from writing its own
// authorization header.
// tslint:disable: no-any
export function createAuthorizingRequest(authorizationHeader: any) {
    class AuthorizingRequest extends nodeFetch.Request {
        constructor(input: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) {
            super(input, init);

            // Add all of the authorization parts onto the headers.
            const origHeaders = this.headers;
            const keys = Object.keys(authorizationHeader);
            keys.forEach((k) => origHeaders.append(k, authorizationHeader[k].toString()));
            origHeaders.append('Content-Type', 'application/json');

            // Rewrite the 'append' method for the headers to disallow 'authorization' after this point
            const origAppend = origHeaders.append.bind(origHeaders);
            origHeaders.append = (k, v) => {
                if (k.toLowerCase() !== 'authorization') {
                    origAppend(k, v);
                }
            };
        }
    }
    return AuthorizingRequest;
}
