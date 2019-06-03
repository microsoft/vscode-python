// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ServerConnection, SessionManager } from '@jupyterlab/services';
import { injectable } from 'inversify';
import * as nodeFetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { CancellationToken } from 'vscode-jsonrpc';

import { IConnection, IJupyterKernelSpec, IJupyterSession, IJupyterSessionManager } from '../types';
import { JupyterKernelSpec } from './jupyterKernelSpec';
import { JupyterSession } from './jupyterSession';

@injectable()
export class JupyterSessionManager implements IJupyterSessionManager {

    public async startNew(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, cancelToken?: CancellationToken) : Promise<IJupyterSession> {
        // Create a new session and attempt to connect to it
        const session = new JupyterSession(connInfo, kernelSpec);
        try {
            await session.connect(cancelToken);
        } finally {
            if (!session.isConnected) {
                await session.dispose();
            }
        }
        return session;
    }

    public getPWSettings = async(): Promise<[string, string, string]> => {
        let xsrfCookieValue: string = '';
        let sessionCookieName: string = '';
        let sessionCookieValue: string = '';

        // First do a get to get the xsrf for the login page
        // tslint:disable-next-line:no-http-string
        let res = await nodeFetch.default('http://ianhumain2:9998/login?', {
            method: 'get',
            redirect: 'manual',
            headers: { Connection: 'keep-alive' }
        });

        // Get the xsrf cookie from the response
        let cookies: string | null = res.headers.get('set-cookie');

        if (cookies) {
            const cookieSplit = cookies.split(';');
            cookieSplit.forEach(value => {
                const valueSplit = value.split('=');
                if (valueSplit[0] === '_xsrf') {
                    xsrfCookieValue = valueSplit[1];
                }
            });
        }

        // Now we need to hit the server with our xsrf cookie and the password

        // Create the form params that we need
        const postParams = new URLSearchParams();
        postParams.append('_xsrf', xsrfCookieValue!);
        postParams.append('password', 'Python');

        // tslint:disable-next-line:no-http-string
        res = await nodeFetch.default('http://ianhumain2:9998/login?', {
            method: 'post',
            headers: { 'X-XSRFToken': xsrfCookieValue!, Cookie: `_xsrf=${xsrfCookieValue}`, Connection: 'keep-alive' },
            body: postParams,
            redirect: 'manual'
        });

        // Now from this result we need to extract the session cookie
        cookies = res.headers.get('set-cookie');

        if (cookies) {
            const firstEquals = cookies.indexOf('=');
            sessionCookieName = cookies.substring(0, firstEquals);
            sessionCookieValue = cookies.substring(firstEquals + 1, cookies.indexOf(';'));
        }

        // Return our pulled values
        return [xsrfCookieValue, sessionCookieName, sessionCookieValue];
    }

    public async getActiveKernelSpecs(connection: IConnection) : Promise<IJupyterKernelSpec[]> {
        let sessionManager: SessionManager | undefined ;
        try {
            const pwSettings = await this.getPWSettings();

            const cookieString = `_xsrf=${pwSettings[0]}; ${pwSettings[1]}=${pwSettings[2]}`;
            // tslint:disable-next-line:no-http-string
            const reqHeaders = { Cookie: cookieString, 'X-XSRFToken': pwSettings[0], Connection: 'keep-alive', 'Cache-Control': 'max-age=0', 'Upgrade-Insecure-Requests': '1', Referer: 'http://ianhumain2:9998/login?next=/tree?' };
            // Now here we are going to try to connect using the services
            const serverSettings = ServerConnection.makeSettings(
                {
                    // tslint:disable-next-line:no-http-string
                    baseUrl: 'http://ianhumain2:9998',
                    token: '',
                    pageUrl: '',
                    // A web socket is required to allow token authentication
                    wsUrl: 'ws://ianhumain2:9998',
                    init: { cache: 'no-store', credentials: 'same-origin', headers: reqHeaders }
                });
            // Use our connection to create a session manager
            //const serverSettings = ServerConnection.makeSettings(
                //{
                    //baseUrl: connection.baseUrl,
                    //token: connection.token,
                    //pageUrl: '',
                    //// A web socket is required to allow token authentication (what if there is no token authentication?)
                    //wsUrl: connection.baseUrl.replace('http', 'ws'),
                    //init: { cache: 'no-store', credentials: 'same-origin' }
                //});
            sessionManager = new SessionManager({ serverSettings: serverSettings });

            // Ask the session manager to refresh its list of kernel specs.
            await sessionManager.refreshSpecs();

            // Enumerate all of the kernel specs, turning each into a JupyterKernelSpec
            const kernelspecs = sessionManager.specs && sessionManager.specs.kernelspecs ? sessionManager.specs.kernelspecs : {};
            const keys = Object.keys(kernelspecs);
            return keys.map(k => {
                const spec = kernelspecs[k];
                return new JupyterKernelSpec(spec) as IJupyterKernelSpec;
            });
        } catch {
            // For some reason this is failing. Just return nothing
            return [];
        } finally {
            // Cleanup the session manager as we don't need it anymore
            if (sessionManager) {
                sessionManager.dispose();
            }
        }

    }

}
