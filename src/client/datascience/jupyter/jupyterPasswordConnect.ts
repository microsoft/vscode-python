// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Agent as HttpsAgent } from 'https';
import { inject, injectable } from 'inversify';
import * as nodeFetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { IApplicationShell } from '../../common/application/types';
import * as localize from '../../common/utils/localize';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { IJupyterPasswordConnect, IJupyterPasswordConnectInfo } from '../types';
import { Telemetry } from './../constants';

@injectable()
export class JupyterPasswordConnect implements IJupyterPasswordConnect {
    constructor(@inject(IApplicationShell) private appShell: IApplicationShell) {}

    @captureTelemetry(Telemetry.GetPasswordAttempt)
    public async getPasswordConnectionInfo(
        url: string,
        allowUnauthorized: boolean,
        fetchFunction?: (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => Promise<nodeFetch.Response>
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        // For testing allow for our fetch function to be overridden
        if (!fetchFunction) {
            fetchFunction = nodeFetch.default;
        }

        let xsrfCookie: string | undefined;
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;

        if (!url || url.length < 1) {
            return undefined;
        }

        // Add on a trailing slash to our URL if it's not there already
        let newUrl = url;
        if (newUrl[newUrl.length - 1] !== '/') {
            newUrl = `${newUrl}/`;
        }

        // Get password first
        let userPassword = await this.getUserPassword();

        if (userPassword) {
            // First get the xsrf cookie by hitting the initial login page
            xsrfCookie = await this.getXSRFToken(url, allowUnauthorized, fetchFunction);

            // Then get the session cookie by hitting that same page with the xsrftoken and the password
            if (xsrfCookie) {
                const sessionResult = await this.getSessionCookie(
                    url,
                    allowUnauthorized,
                    xsrfCookie,
                    userPassword,
                    fetchFunction
                );
                sessionCookieName = sessionResult.sessionCookieName;
                sessionCookieValue = sessionResult.sessionCookieValue;
            }
        } else {
            // If userPassword is undefined or '' then the user didn't pick a password. In this case return back that we should just try to connect
            // like a standard connection. Might be the case where there is no token and no password
            return { emptyPassword: true, xsrfCookie: '', sessionCookieName: '', sessionCookieValue: '' };
        }
        userPassword = undefined;

        // If we found everything return it all back if not, undefined as partial is useless
        if (xsrfCookie && sessionCookieName && sessionCookieValue) {
            sendTelemetryEvent(Telemetry.GetPasswordSuccess);
            return { xsrfCookie, sessionCookieName, sessionCookieValue, emptyPassword: false };
        } else {
            sendTelemetryEvent(Telemetry.GetPasswordFailure);
            return undefined;
        }
    }

    // For HTTPS connections respect our allowUnauthorized setting by adding in an agent to enable that on the request
    private addAllowUnauthorized(
        url: string,
        allowUnauthorized: boolean,
        options: nodeFetch.RequestInit
    ): nodeFetch.RequestInit {
        if (url.startsWith('https') && allowUnauthorized) {
            const requestAgent = new HttpsAgent({ rejectUnauthorized: false });
            return { ...options, agent: requestAgent };
        }

        return options;
    }

    private async getUserPassword(): Promise<string | undefined> {
        // First get the proposed URI from the user
        return this.appShell.showInputBox({
            prompt: localize.DataScience.jupyterSelectPasswordPrompt(),
            ignoreFocusOut: true,
            password: true,
        });
    }

    private async getXSRFToken(
        url: string,
        allowUnauthorized: boolean,
        fetchFunction: (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => Promise<nodeFetch.Response>
    ): Promise<string | undefined> {
        let xsrfCookie: string | undefined;

        const response = await fetchFunction(
            `${url}login?`,
            this.addAllowUnauthorized(url, allowUnauthorized, {
                method: 'get',
                redirect: 'manual',
                headers: { Connection: 'keep-alive' },
            })
        );

        if (response.ok) {
            const cookies = this.getCookies(response);
            if (cookies.has('_xsrf')) {
                xsrfCookie = cookies.get('_xsrf');
            }
        }

        return xsrfCookie;
    }

    // Jupyter uses a session cookie to validate so by hitting the login page with the password we can get that cookie and use it ourselves
    // This workflow can be seen by running fiddler and hitting the login page with a browser
    // First you need a get at the login page to get the xsrf token, then you send back that token along with the password in a post
    // That will return back the session cookie. This session cookie then needs to be added to our requests and websockets for @jupyterlab/services
    private async getSessionCookie(
        url: string,
        allowUnauthorized: boolean,
        xsrfCookie: string,
        password: string,
        fetchFunction: (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => Promise<nodeFetch.Response>
    ): Promise<{ sessionCookieName: string | undefined; sessionCookieValue: string | undefined }> {
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;
        // Create the form params that we need
        const postParams = new URLSearchParams();
        postParams.append('_xsrf', xsrfCookie);
        postParams.append('password', password);

        const response = await fetchFunction(
            `${url}login?`,
            this.addAllowUnauthorized(url, allowUnauthorized, {
                method: 'post',
                headers: {
                    Cookie: `_xsrf=${xsrfCookie}`,
                    Connection: 'keep-alive',
                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: postParams.toString(),
                redirect: 'manual',
            })
        );

        // Now from this result we need to extract the session cookie
        if (response.status === 302) {
            const cookies = this.getCookies(response);

            // Session cookie is the first one
            if (cookies.size > 0) {
                sessionCookieName = cookies.entries().next().value[0];
                sessionCookieValue = cookies.entries().next().value[1];
            }
        }

        return { sessionCookieName, sessionCookieValue };
    }

    private getCookies(response: nodeFetch.Response): Map<string, string> {
        const cookieList: Map<string, string> = new Map<string, string>();

        const cookies: string | null = response.headers.get('set-cookie');

        if (cookies) {
            cookies.split(';').forEach((value) => {
                const cookieKey = value.substring(0, value.indexOf('='));
                const cookieVal = value.substring(value.indexOf('=') + 1);
                cookieList.set(cookieKey, cookieVal);
            });
        }

        return cookieList;
    }
}
