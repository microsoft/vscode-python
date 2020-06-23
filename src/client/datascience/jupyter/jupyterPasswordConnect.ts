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
    private savedConnectInfo = new Map<string, Promise<IJupyterPasswordConnectInfo | undefined>>();
    private fetchFunction: (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => Promise<nodeFetch.Response> =
        nodeFetch.default;

    constructor(@inject(IApplicationShell) private appShell: IApplicationShell) {}

    @captureTelemetry(Telemetry.GetPasswordAttempt)
    public getPasswordConnectionInfo(
        url: string,
        allowUnauthorized: boolean,
        fetchFunction?: (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => Promise<nodeFetch.Response>
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        if (!url || url.length < 1) {
            return Promise.resolve(undefined);
        }

        // Update our fetch function if necessary
        if (fetchFunction) {
            this.fetchFunction = fetchFunction;
        }

        // Add on a trailing slash to our URL if it's not there already
        let newUrl = url;
        if (newUrl[newUrl.length - 1] !== '/') {
            newUrl = `${newUrl}/`;
        }

        // See if we already have this data. Don't need to ask for a password more than once. (This can happen in remote when listing kernels)
        let result = this.savedConnectInfo.get(newUrl);
        if (!result) {
            result = this.getNonCachedPasswordConnectionInfo(newUrl, allowUnauthorized);
            this.savedConnectInfo.set(newUrl, result);
        }

        return result;
    }

    private getSessionCookieString(xsrfCookie: string, sessionCookieName: string, sessionCookieValue: string): string {
        return `_xsrf=${xsrfCookie}; ${sessionCookieName}=${sessionCookieValue}`;
    }

    private async getNonCachedPasswordConnectionInfo(
        url: string,
        allowUnauthorized: boolean
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        // If jupyter hub, go down a special path of asking jupyter hub for a token
        if (await this.isJupyterHub(url, allowUnauthorized)) {
            return this.getJupyterHubConnectionInfo(url, allowUnauthorized);
        } else {
            return this.getJupyterConnectionInfo(url, allowUnauthorized);
        }
    }

    private async getJupyterHubConnectionInfo(
        uri: string,
        allowUnauthorized: boolean
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        // We're using jupyter hub. Get the base url
        let url: URL;
        try {
            url = new URL(uri);
        } catch (err) {
            // This should already have been parsed when set, so just throw if it's not right here
            throw err;
        }
        const baseUrl = `${url.protocol}//${url.host}`;

        // First ask for the user name and password
        const user = await this.getUserName();
        const password = user ? await this.getUserPassword() : '';

        // Use these in a post request to get the token to use
        const response = await this.fetchFunction(
            `${baseUrl}/hub/api/authorizations/token`, // This seems to be deprecated, but it works. It requests a new token
            this.addAllowUnauthorized(baseUrl, allowUnauthorized, {
                method: 'post',
                headers: {
                    Connection: 'keep-alive',
                    'content-type': 'application/json;charset=UTF-8'
                },
                body: `{ "username": "${user || ''}", "password": "${password || ''}"  }`,
                redirect: 'manual'
            })
        );

        if (response.ok && response.status === 200) {
            const body = await response.json();
            if (body && body.user && body.user.server && body.token) {
                // Response should have the token to use for this user.
                return {
                    requestHeaders: {},
                    remappedBaseUrl: `${baseUrl}/hub/api${body.user.server}`,
                    remappedToken: body.token
                };
            }
        }
    }

    private async getJupyterConnectionInfo(
        url: string,
        allowUnauthorized: boolean
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        let xsrfCookie: string | undefined;
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;

        // First determine if we need a password. A request for the base URL with /tree? should return a 302 if we do.
        if (await this.needPassword(url, allowUnauthorized)) {
            // Get password first
            let userPassword = await this.getUserPassword();

            if (userPassword) {
                xsrfCookie = await this.getXSRFToken(url, allowUnauthorized);

                // Then get the session cookie by hitting that same page with the xsrftoken and the password
                if (xsrfCookie) {
                    const sessionResult = await this.getSessionCookie(url, allowUnauthorized, xsrfCookie, userPassword);
                    sessionCookieName = sessionResult.sessionCookieName;
                    sessionCookieValue = sessionResult.sessionCookieValue;
                }
            } else {
                // If userPassword is undefined or '' then the user didn't pick a password. In this case return back that we should just try to connect
                // like a standard connection. Might be the case where there is no token and no password
                return {};
            }
            userPassword = undefined;
        } else {
            // If no password needed, act like empty password and no cookie
            return {};
        }

        // If we found everything return it all back if not, undefined as partial is useless
        if (xsrfCookie && sessionCookieName && sessionCookieValue) {
            sendTelemetryEvent(Telemetry.GetPasswordSuccess);
            const cookieString = this.getSessionCookieString(xsrfCookie, sessionCookieName, sessionCookieValue);
            const requestHeaders = { Cookie: cookieString, 'X-XSRFToken': xsrfCookie };
            return { requestHeaders };
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

    private async getUserName(): Promise<string | undefined> {
        return this.appShell.showInputBox({
            prompt: localize.DataScience.jupyterSelectUserPrompt(),
            ignoreFocusOut: true,
            password: false
        });
    }

    private async getUserPassword(): Promise<string | undefined> {
        return this.appShell.showInputBox({
            prompt: localize.DataScience.jupyterSelectPasswordPrompt(),
            ignoreFocusOut: true,
            password: true
        });
    }

    private async getXSRFToken(url: string, allowUnauthorized: boolean): Promise<string | undefined> {
        let xsrfCookie: string | undefined;

        const response = await this.fetchFunction(
            `${url}login?`,
            this.addAllowUnauthorized(url, allowUnauthorized, {
                method: 'get',
                redirect: 'manual',
                headers: { Connection: 'keep-alive' }
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

    private async needPassword(url: string, allowUnauthorized: boolean): Promise<boolean> {
        // A jupyter server will redirect if you ask for the tree when a login is required
        const response = await this.fetchFunction(
            `${url}tree?`,
            this.addAllowUnauthorized(url, allowUnauthorized, {
                method: 'get',
                redirect: 'manual',
                headers: { Connection: 'keep-alive' }
            })
        );

        return response.status !== 200;
    }

    private async isJupyterHub(url: string, allowUnauthorized: boolean): Promise<boolean> {
        // See this for the different REST endpoints:
        // https://jupyterhub.readthedocs.io/en/stable/_static/rest-api/index.html

        // If the URL has the /user/ option in it, it's likely this is jupyter hub
        if (url.toLowerCase().includes('/user/')) {
            return true;
        }

        // Otherwise request hub/api. This should return the json with the hub version
        // if this is a hub url
        const response = await this.fetchFunction(
            `${url}hub/api`,
            this.addAllowUnauthorized(url, allowUnauthorized, {
                method: 'get',
                redirect: 'manual',
                headers: { Connection: 'keep-alive' }
            })
        );

        return response.status === 200;
    }

    // Jupyter uses a session cookie to validate so by hitting the login page with the password we can get that cookie and use it ourselves
    // This workflow can be seen by running fiddler and hitting the login page with a browser
    // First you need a get at the login page to get the xsrf token, then you send back that token along with the password in a post
    // That will return back the session cookie. This session cookie then needs to be added to our requests and websockets for @jupyterlab/services
    private async getSessionCookie(
        url: string,
        allowUnauthorized: boolean,
        xsrfCookie: string,
        password: string
    ): Promise<{ sessionCookieName: string | undefined; sessionCookieValue: string | undefined }> {
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;
        // Create the form params that we need
        const postParams = new URLSearchParams();
        postParams.append('_xsrf', xsrfCookie);
        postParams.append('password', password);

        const response = await this.fetchFunction(
            `${url}login?`,
            this.addAllowUnauthorized(url, allowUnauthorized, {
                method: 'post',
                headers: {
                    Cookie: `_xsrf=${xsrfCookie}`,
                    Connection: 'keep-alive',
                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                body: postParams.toString(),
                redirect: 'manual'
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
