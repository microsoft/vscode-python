// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Agent as HttpsAgent } from 'https';
import { inject, injectable } from 'inversify';
import * as nodeFetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IAsyncDisposableRegistry, IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IMultiStepInput, IMultiStepInputFactory } from '../../common/utils/multiStepInput';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { IJupyterPasswordConnect, IJupyterPasswordConnectInfo } from '../types';
import { Telemetry } from './../constants';

@injectable()
export class JupyterPasswordConnect implements IJupyterPasswordConnect {
    private savedConnectInfo = new Map<string, Promise<IJupyterPasswordConnectInfo | undefined>>();
    private fetchFunction: (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => Promise<nodeFetch.Response> =
        nodeFetch.default;

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IAsyncDisposableRegistry) private readonly asyncDisposableRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) private readonly configService: IConfigurationService
    ) {}

    @captureTelemetry(Telemetry.GetPasswordAttempt)
    public getPasswordConnectionInfo(
        url: string,
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
            result = this.getNonCachedPasswordConnectionInfo(newUrl);
            this.savedConnectInfo.set(newUrl, result);
        }

        return result;
    }

    private getSessionCookieString(xsrfCookie: string, sessionCookieName: string, sessionCookieValue: string): string {
        return `_xsrf=${xsrfCookie}; ${sessionCookieName}=${sessionCookieValue}`;
    }

    private async getNonCachedPasswordConnectionInfo(url: string): Promise<IJupyterPasswordConnectInfo | undefined> {
        // If jupyter hub, go down a special path of asking jupyter hub for a token
        if (await this.isJupyterHub(url)) {
            return this.getJupyterHubConnectionInfo(url);
        } else {
            return this.getJupyterConnectionInfo(url);
        }
    }

    private async getJupyterHubConnectionInfo(uri: string): Promise<IJupyterPasswordConnectInfo | undefined> {
        // First ask for the user name and password
        const userNameAndPassword = await this.getUserNameAndPassword();
        if (userNameAndPassword.username || userNameAndPassword.password) {
            // Try the login method. It should work and doesn't require a token to be generated.
            const result = await this.getJupyterHubConnectionInfoFromLogin(
                uri,
                userNameAndPassword.username,
                userNameAndPassword.password
            );

            // If login method fails, try generating a token
            if (!result) {
                return this.getJupyterHubConnectionInfoFromApi(
                    uri,
                    userNameAndPassword.username,
                    userNameAndPassword.password
                );
            }

            return result;
        }
    }

    private async getJupyterHubConnectionInfoFromLogin(
        uri: string,
        username: string,
        password: string
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        // We're using jupyter hub. Get the base url
        const url = new URL(uri);
        const baseUrl = `${url.protocol}//${url.host}`;

        const postParams = new URLSearchParams();
        postParams.append('username', username || '');
        postParams.append('password', password || '');

        let response = await this.makeRequest(`${baseUrl}/hub/login?next=`, {
            method: 'POST',
            headers: {
                Connection: 'keep-alive',
                Referer: `${baseUrl}/hub/login`,
                'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: postParams.toString(),
            redirect: 'manual'
        });

        // The cookies from that response should be used to make the next set of requests
        if (response && response.status === 302) {
            const cookies = this.getCookies(response);
            const cookieString = [...cookies.entries()].reduce((p, c) => `${p};${c[0]}=${c[1]}`, '');
            // See this API for creating a token
            // https://jupyterhub.readthedocs.io/en/stable/_static/rest-api/index.html#operation--users--name--tokens-post
            response = await this.makeRequest(`${baseUrl}/hub/api/users/${username}/tokens`, {
                method: 'POST',
                headers: {
                    Connection: 'keep-alive',
                    Cookie: cookieString,
                    Referer: `${baseUrl}/hub/login`
                }
            });

            // That should give us a new token. For now server name is hard coded. Not sure
            // how to fetch it other than in the info for a default token
            if (response.ok && response.status === 200) {
                const body = await response.json();
                if (body && body.token && body.id) {
                    // Response should have the token to use for this user.

                    // Make sure the server is running for this user. Don't need
                    // to check response as it will fail if already running.
                    // https://jupyterhub.readthedocs.io/en/stable/_static/rest-api/index.html#operation--users--name--server-post
                    await this.makeRequest(`${baseUrl}/hub/api/users/${username}/server`, {
                        method: 'POST',
                        headers: {
                            Connection: 'keep-alive',
                            Cookie: cookieString,
                            Referer: `${baseUrl}/hub/login`
                        }
                    });

                    // This token was generated for this request. We should clean it up when
                    // the user closes VS code
                    this.asyncDisposableRegistry.push({
                        dispose: async () => {
                            this.makeRequest(`${baseUrl}/hub/api/users/${username}/tokens/${body.id}`, {
                                method: 'DELETE',
                                headers: {
                                    Connection: 'keep-alive',
                                    Cookie: cookieString,
                                    Referer: `${baseUrl}/hub/login`
                                }
                            }).ignoreErrors(); // Don't wait for this during shutdown. Just make the request
                        }
                    });

                    return {
                        requestHeaders: {},
                        remappedBaseUrl: `${baseUrl}/user/${username}`,
                        remappedToken: body.token
                    };
                }
            }
        }
    }

    private async getJupyterHubConnectionInfoFromApi(
        uri: string,
        username: string,
        password: string
    ): Promise<IJupyterPasswordConnectInfo | undefined> {
        // We're using jupyter hub. Get the base url
        const url = new URL(uri);
        const baseUrl = `${url.protocol}//${url.host}`;
        // Use these in a post request to get the token to use
        const response = await this.makeRequest(
            `${baseUrl}/hub/api/authorizations/token`, // This seems to be deprecated, but it works. It requests a new token
            {
                method: 'POST',
                headers: {
                    Connection: 'keep-alive',
                    'content-type': 'application/json;charset=UTF-8'
                },
                body: `{ "username": "${username || ''}", "password": "${password || ''}"  }`,
                redirect: 'manual'
            }
        );

        if (response.ok && response.status === 200) {
            const body = await response.json();
            if (body && body.user && body.user.server && body.token) {
                // Response should have the token to use for this user.
                return {
                    requestHeaders: {},
                    remappedBaseUrl: `${baseUrl}${body.user.server}`,
                    remappedToken: body.token
                };
            }
        }
    }

    private async getJupyterConnectionInfo(url: string): Promise<IJupyterPasswordConnectInfo | undefined> {
        let xsrfCookie: string | undefined;
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;

        // First determine if we need a password. A request for the base URL with /tree? should return a 302 if we do.
        if (await this.needPassword(url)) {
            // Get password first
            let userPassword = await this.getUserPassword();

            if (userPassword) {
                xsrfCookie = await this.getXSRFToken(url);

                // Then get the session cookie by hitting that same page with the xsrftoken and the password
                if (xsrfCookie) {
                    const sessionResult = await this.getSessionCookie(url, xsrfCookie, userPassword);
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

    private async getUserNameAndPassword(): Promise<{ username: string; password: string }> {
        const multistep = this.multiStepFactory.create<{ username: string; password: string }>();
        const state = { username: '', password: '' };
        await multistep.run(this.getUserNameMultiStep.bind(this), state);
        return state;
    }

    private async getUserNameMultiStep(
        input: IMultiStepInput<{ username: string; password: string }>,
        state: { username: string; password: string }
    ) {
        state.username = await input.showInputBox({
            title: localize.DataScience.jupyterSelectUserAndPasswordTitle(),
            prompt: localize.DataScience.jupyterSelectUserPrompt(),
            validate: this.validateUserNameOrPassword,
            value: ''
        });
        if (state.username) {
            return this.getPasswordMultiStep.bind(this);
        }
    }

    private async validateUserNameOrPassword(_value: string): Promise<string | undefined> {
        return undefined;
    }

    private async getPasswordMultiStep(
        input: IMultiStepInput<{ username: string; password: string }>,
        state: { username: string; password: string }
    ) {
        state.password = await input.showInputBox({
            title: localize.DataScience.jupyterSelectUserAndPasswordTitle(),
            prompt: localize.DataScience.jupyterSelectPasswordPrompt(),
            validate: this.validateUserNameOrPassword,
            value: '',
            password: true
        });
    }

    private async getUserPassword(): Promise<string | undefined> {
        return this.appShell.showInputBox({
            prompt: localize.DataScience.jupyterSelectPasswordPrompt(),
            ignoreFocusOut: true,
            password: true
        });
    }

    private async getXSRFToken(url: string): Promise<string | undefined> {
        let xsrfCookie: string | undefined;

        const response = await this.makeRequest(`${url}login?`, {
            method: 'get',
            redirect: 'manual',
            headers: { Connection: 'keep-alive' }
        });

        if (response.ok) {
            const cookies = this.getCookies(response);
            if (cookies.has('_xsrf')) {
                xsrfCookie = cookies.get('_xsrf')?.split(';')[0];
            }
        }

        return xsrfCookie;
    }

    private async needPassword(url: string): Promise<boolean> {
        // A jupyter server will redirect if you ask for the tree when a login is required
        const response = await this.makeRequest(`${url}tree?`, {
            method: 'get',
            redirect: 'manual',
            headers: { Connection: 'keep-alive' }
        });

        return response.status !== 200;
    }

    private async makeRequest(url: string, options: nodeFetch.RequestInit): Promise<nodeFetch.Response> {
        const allowUnauthorized = this.configService.getSettings(undefined).datascience
            .allowUnauthorizedRemoteConnection;

        // Try once and see if it fails with unauthorized.
        try {
            return await this.fetchFunction(
                url,
                this.addAllowUnauthorized(url, allowUnauthorized ? true : false, options)
            );
        } catch (e) {
            if (e.message.indexOf('reason: self signed certificate') >= 0) {
                // Ask user to change setting and possibly try again.
                const enableOption: string = localize.DataScience.jupyterSelfCertEnable();
                const closeOption: string = localize.DataScience.jupyterSelfCertClose();
                const value = await this.appShell.showErrorMessage(
                    localize.DataScience.jupyterSelfCertFail().format(e.message),
                    enableOption,
                    closeOption
                );
                if (value === enableOption) {
                    sendTelemetryEvent(Telemetry.SelfCertsMessageEnabled);
                    await this.configService.updateSetting(
                        'dataScience.allowUnauthorizedRemoteConnection',
                        true,
                        undefined,
                        ConfigurationTarget.Workspace
                    );
                    return this.fetchFunction(url, this.addAllowUnauthorized(url, true, options));
                } else if (value === closeOption) {
                    sendTelemetryEvent(Telemetry.SelfCertsMessageClose);
                }
            }
            throw e;
        }
    }

    private async isJupyterHub(url: string): Promise<boolean> {
        // See this for the different REST endpoints:
        // https://jupyterhub.readthedocs.io/en/stable/_static/rest-api/index.html

        // If the URL has the /user/ option in it, it's likely this is jupyter hub
        if (url.toLowerCase().includes('/user/')) {
            return true;
        }

        // Otherwise request hub/api. This should return the json with the hub version
        // if this is a hub url
        const response = await this.makeRequest(`${url}hub/api`, {
            method: 'get',
            redirect: 'manual',
            headers: { Connection: 'keep-alive' }
        });

        return response.status === 200;
    }

    // Jupyter uses a session cookie to validate so by hitting the login page with the password we can get that cookie and use it ourselves
    // This workflow can be seen by running fiddler and hitting the login page with a browser
    // First you need a get at the login page to get the xsrf token, then you send back that token along with the password in a post
    // That will return back the session cookie. This session cookie then needs to be added to our requests and websockets for @jupyterlab/services
    private async getSessionCookie(
        url: string,
        xsrfCookie: string,
        password: string
    ): Promise<{ sessionCookieName: string | undefined; sessionCookieValue: string | undefined }> {
        let sessionCookieName: string | undefined;
        let sessionCookieValue: string | undefined;
        // Create the form params that we need
        const postParams = new URLSearchParams();
        postParams.append('_xsrf', xsrfCookie);
        postParams.append('password', password);

        const response = await this.makeRequest(`${url}login?`, {
            method: 'post',
            headers: {
                Cookie: `_xsrf=${xsrfCookie}`,
                Connection: 'keep-alive',
                'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: postParams.toString(),
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

        return { sessionCookieName, sessionCookieValue };
    }

    private getCookies(response: nodeFetch.Response): Map<string, string> {
        const cookieList: Map<string, string> = new Map<string, string>();

        const cookies = response.headers.raw()['set-cookie'];

        if (cookies) {
            cookies.forEach((value) => {
                const cookieKey = value.substring(0, value.indexOf('='));
                const cookieVal = value.substring(value.indexOf('=') + 1);
                cookieList.set(cookieKey, cookieVal);
            });
        }

        return cookieList;
    }
}
