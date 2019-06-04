// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as nodeFetch from 'node-fetch';
import { URLSearchParams } from 'url';
import * as WebSocketWS from 'ws';
import { IApplicationShell } from '../../common/application/types';
import * as localize from '../../common/utils/localize';
import { IJupyterPasswordConnect, IJupyterPasswordConnectInfo } from '../types';

@injectable()
export class JupyterPasswordConnect implements IJupyterPasswordConnect {
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell
    ) {
    }

    public async getPasswordConnectionInfo(url: string): Promise<IJupyterPasswordConnectInfo | undefined> {
        let xsrfCookie: string | undefined;
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;

        // IANHU: Validation on url, end with slash?

        // Get password first
        const userPassword = await this.getUserPassword();

        if (userPassword) {
            // First get the xsrf cookie by hitting the initial login page
            xsrfCookie = await this.getXSRFToken(url);

            // Then get the session cookie by hitting that same page with the xsrftoken and the password
            if (xsrfCookie) {
                const sessionResult = await this.getSessionCookie(url, xsrfCookie, userPassword);
                sessionCookieName = sessionResult[0];
                sessionCookieValue = sessionResult[1];
            }
        }

        // If we found everything return it all back if not, undefined as partial is useless
        if (xsrfCookie && sessionCookieName && sessionCookieValue) {
            return { xsrfCookie, sessionCookieName, sessionCookieValue };
        } else {
            return undefined;
        }
    }

    private async getUserPassword() : Promise<string | undefined> {
        // First get the proposed URI from the user
        return this.appShell.showInputBox({
            prompt: localize.DataScience.jupyterSelectPasswordPrompt(),
            ignoreFocusOut: true
        });
    }

    private async getXSRFToken(url: string): Promise<string | undefined> {
        let xsrfCookie: string | undefined;

        const response = await nodeFetch.default(`${url}login?`, {
            method: 'get',
            redirect: 'manual',
            headers: { Connection: 'keep-alive' }
        });

        if (response.ok) {
            const cookies = this.getCookies(response);
            if (cookies.has('_xsrf')) {
                xsrfCookie = cookies.get('_xsrf');
            }
        }

        return xsrfCookie;
    }

    private async getSessionCookie(url: string, xsrfCookie: string, password: string): Promise<[string | undefined, string | undefined]> {
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;
        // Create the form params that we need
        const postParams = new URLSearchParams();
        postParams.append('_xsrf', xsrfCookie);
        postParams.append('password', password);

        const response = await nodeFetch.default(`${url}login?`, {
            method: 'post',
            // IANHU: Remove
            //headers: { 'X-XSRFToken': xsrfCookieValue!, Cookie: `_xsrf=${xsrfCookieValue}`, Connection: 'keep-alive' },
            headers: { Cookie: `_xsrf=${xsrfCookie}`, Connection: 'keep-alive' },
            body: postParams,
            redirect: 'manual'
        });

        // Now from this result we need to extract the session cookie
        if (response.status === 302) {
            const cookies = this.getCookies(response);

            // Session cookie is the first one
            if (cookies.size > 0) {
                sessionCookieName = cookies.entries().next().value[0];
                sessionCookieValue = cookies.entries().next().value[1];
            }
        }

        return [sessionCookieName, sessionCookieValue];
    }

    private getCookies(response: nodeFetch.Response): Map<string, string> {
        const cookieList: Map<string, string> = new Map<string, string>();

        const cookies: string | null = response.headers.get('set-cookie');

        if (cookies) {
            cookies.split(';').forEach(value => {
                // IANHU: verify cookie looks as expected?
                const cookieKey = value.substring(0, value.indexOf('='));
                const cookieVal = value.substring(value.indexOf('=') + 1);
                cookieList.set(cookieKey, cookieVal);
            });
        }

        return cookieList;
    }
}
