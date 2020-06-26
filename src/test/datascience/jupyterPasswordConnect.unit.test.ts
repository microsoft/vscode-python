// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as nodeFetch from 'node-fetch';
import * as typemoq from 'typemoq';

import { anything, instance, mock, when } from 'ts-mockito';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { ConfigurationService } from '../../client/common/configuration/service';
import { MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { JupyterPasswordConnect } from '../../client/datascience/jupyter/jupyterPasswordConnect';
import { MockInputBox } from './mockInputBox';
import { MockQuickPick } from './mockQuickPick';

// tslint:disable:no-any max-func-body-length no-http-string
suite('JupyterPasswordConnect', () => {
    let jupyterPasswordConnect: JupyterPasswordConnect;
    let appShell: ApplicationShell;
    let configService: ConfigurationService;

    const xsrfValue: string = '12341234';
    const sessionName: string = 'sessionName';
    const sessionValue: string = 'sessionValue';

    setup(() => {
        appShell = mock(ApplicationShell);
        when(appShell.showInputBox(anything())).thenReturn(Promise.resolve('Python'));
        const multiStepFactory = new MultiStepInputFactory(instance(appShell));
        const mockDisposableRegistry = mock(AsyncDisposableRegistry);
        configService = mock(ConfigurationService);

        jupyterPasswordConnect = new JupyterPasswordConnect(
            instance(appShell),
            multiStepFactory,
            instance(mockDisposableRegistry),
            instance(configService)
        );
    });

    function createMockSetup(secure: boolean, ok: boolean) {
        const dsSettings = {
            allowUnauthorizedRemoteConnection: secure
            // tslint:disable-next-line: no-any
        } as any;
        when(configService.getSettings(anything())).thenReturn({ datascience: dsSettings } as any);
        when(configService.updateSetting('dataScience.jupyterServerURI', anything(), anything(), anything())).thenCall(
            (_a1, _a2, _a3, _a4) => {
                return Promise.resolve();
            }
        );

        // Set up our fake node fetch
        const fetchMock: typemoq.IMock<typeof nodeFetch.default> = typemoq.Mock.ofInstance(nodeFetch.default);
        const rootUrl = secure ? 'https://TESTNAME:8888/' : 'http://TESTNAME:8888/';

        // Mock our first call to get xsrf cookie
        const mockXsrfResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockXsrfHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockXsrfHeaders
            .setup((mh) => mh.raw())
            .returns(() => {
                return { 'set-cookie': [`_xsrf=${xsrfValue}`] };
            });
        mockXsrfResponse.setup((mr) => mr.ok).returns(() => ok);
        mockXsrfResponse.setup((mr) => mr.status).returns(() => 302);
        mockXsrfResponse.setup((mr) => mr.headers).returns(() => mockXsrfHeaders.object);

        const mockHubResponse = typemoq.Mock.ofType(nodeFetch.Response);
        mockHubResponse.setup((mr) => mr.ok).returns(() => false);
        mockHubResponse.setup((mr) => mr.status).returns(() => 404);

        fetchMock
            .setup((fm) =>
                fm(
                    `${rootUrl}login?`,
                    typemoq.It.isObjectWith({
                        method: 'get',
                        headers: { Connection: 'keep-alive' }
                    })
                )
            )
            .returns(() => Promise.resolve(mockXsrfResponse.object));
        fetchMock
            .setup((fm) =>
                fm(
                    `${rootUrl}tree?`,
                    typemoq.It.isObjectWith({
                        method: 'get',
                        headers: { Connection: 'keep-alive' }
                    })
                )
            )
            .returns(() => Promise.resolve(mockXsrfResponse.object));
        fetchMock
            .setup((fm) =>
                fm(
                    `${rootUrl}hub/api`,
                    typemoq.It.isObjectWith({
                        method: 'get',
                        headers: { Connection: 'keep-alive' }
                    })
                )
            )
            .returns(() => Promise.resolve(mockHubResponse.object));

        return { fetchMock, mockXsrfHeaders, mockXsrfResponse };
    }

    test('getPasswordConnectionInfo', async () => {
        const { fetchMock, mockXsrfHeaders, mockXsrfResponse } = createMockSetup(false, true);

        // Mock our second call to get session cookie
        const mockSessionResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockSessionHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockSessionHeaders
            .setup((mh) => mh.raw())
            .returns(() => {
                return {
                    'set-cookie': [`${sessionName}=${sessionValue}`]
                };
            });
        mockSessionResponse.setup((mr) => mr.status).returns(() => 302);
        mockSessionResponse.setup((mr) => mr.headers).returns(() => mockSessionHeaders.object);

        // typemoq doesn't love this comparison, so generalize it a bit
        fetchMock
            .setup((fm) =>
                fm(
                    'http://TESTNAME:8888/login?',
                    typemoq.It.isObjectWith({
                        method: 'post',
                        headers: {
                            Cookie: `_xsrf=${xsrfValue}`,
                            Connection: 'keep-alive',
                            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                        }
                    })
                )
            )
            .returns(() => Promise.resolve(mockSessionResponse.object));

        const result = await jupyterPasswordConnect.getPasswordConnectionInfo(
            'http://TESTNAME:8888/',
            fetchMock.object
        );
        assert(result, 'Failed to get password');
        if (result) {
            // tslint:disable-next-line: no-cookies
            assert.ok((result.requestHeaders as any).Cookie, 'No cookie');
        }

        // Verfiy calls
        mockXsrfHeaders.verifyAll();
        mockSessionHeaders.verifyAll();
        mockXsrfResponse.verifyAll();
        mockSessionResponse.verifyAll();
        fetchMock.verifyAll();
    });

    test('getPasswordConnectionInfo allowUnauthorized', async () => {
        const { fetchMock, mockXsrfHeaders, mockXsrfResponse } = createMockSetup(true, true);

        // Mock our second call to get session cookie
        const mockSessionResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockSessionHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockSessionHeaders
            .setup((mh) => mh.raw())
            .returns(() => {
                return {
                    'set-cookie': [`${sessionName}=${sessionValue}`]
                };
            });
        mockSessionResponse.setup((mr) => mr.status).returns(() => 302);
        mockSessionResponse.setup((mr) => mr.headers).returns(() => mockSessionHeaders.object);

        // typemoq doesn't love this comparison, so generalize it a bit
        fetchMock
            .setup((fm) =>
                fm(
                    'https://TESTNAME:8888/login?',
                    typemoq.It.isObjectWith({
                        method: 'post',
                        headers: {
                            Cookie: `_xsrf=${xsrfValue}`,
                            Connection: 'keep-alive',
                            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                        }
                    })
                )
            )
            .returns(() => Promise.resolve(mockSessionResponse.object));

        const result = await jupyterPasswordConnect.getPasswordConnectionInfo(
            'https://TESTNAME:8888/',
            fetchMock.object
        );
        assert(result, 'Failed to get password');
        if (result) {
            // tslint:disable-next-line: no-cookies
            assert.ok((result.requestHeaders as any).Cookie, 'No cookie');
        }

        // Verfiy calls
        mockXsrfHeaders.verifyAll();
        mockSessionHeaders.verifyAll();
        mockXsrfResponse.verifyAll();
        mockSessionResponse.verifyAll();
        fetchMock.verifyAll();
    });

    test('getPasswordConnectionInfo failure', async () => {
        const { fetchMock, mockXsrfHeaders, mockXsrfResponse } = createMockSetup(false, false);

        const result = await jupyterPasswordConnect.getPasswordConnectionInfo(
            'http://TESTNAME:8888/',
            fetchMock.object
        );
        assert(!result);

        // Verfiy calls
        mockXsrfHeaders.verifyAll();
        mockXsrfResponse.verifyAll();
        fetchMock.verifyAll();
    });

    function createJupyterHubSetup() {
        const dsSettings = {
            allowUnauthorizedRemoteConnection: false
            // tslint:disable-next-line: no-any
        } as any;
        when(configService.getSettings(anything())).thenReturn({ datascience: dsSettings } as any);
        when(configService.updateSetting('dataScience.jupyterServerURI', anything(), anything(), anything())).thenCall(
            (_a1, _a2, _a3, _a4) => {
                return Promise.resolve();
            }
        );

        const quickPick = new MockQuickPick('');
        const input = new MockInputBox('test');
        when(appShell.createQuickPick()).thenReturn(quickPick!);
        when(appShell.createInputBox()).thenReturn(input);

        const hubActiveResponse = mock(nodeFetch.Response);
        when(hubActiveResponse.ok).thenReturn(true);
        when(hubActiveResponse.status).thenReturn(200);
        const invalidResponse = mock(nodeFetch.Response);
        when(invalidResponse.ok).thenReturn(false);
        when(invalidResponse.status).thenReturn(404);
        const loginResponse = mock(nodeFetch.Response);
        const loginHeaders = mock(nodeFetch.Headers);
        when(loginHeaders.raw()).thenReturn({ 'set-cookie': ['super-cookie-login=foobar'] });
        when(loginResponse.ok).thenReturn(true);
        when(loginResponse.status).thenReturn(302);
        when(loginResponse.headers).thenReturn(instance(loginHeaders));
        const tokenResponse = mock(nodeFetch.Response);
        when(tokenResponse.ok).thenReturn(true);
        when(tokenResponse.status).thenReturn(200);
        when(tokenResponse.json()).thenResolve({
            token: 'foobar',
            id: '1'
        });

        instance(hubActiveResponse as any).then = undefined;
        instance(invalidResponse as any).then = undefined;
        instance(loginResponse as any).then = undefined;
        instance(tokenResponse as any).then = undefined;

        return async (url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) => {
            const urlString = url.toString().toLowerCase();
            if (urlString === 'http://testname:8888/hub/api') {
                return instance(hubActiveResponse);
            } else if (urlString === 'http://testname:8888/hub/login?next=') {
                return instance(loginResponse);
            } else if (
                urlString === 'http://testname:8888/hub/api/users/test/tokens' &&
                init &&
                init.method === 'POST' &&
                (init.headers as any).Referer === 'http://testname:8888/hub/login' &&
                (init.headers as any).Cookie === ';super-cookie-login=foobar'
            ) {
                return instance(tokenResponse);
            }
            return instance(invalidResponse);
        };
    }
    test('getPasswordConnectionInfo jupyter hub', async () => {
        const fetchMock = createJupyterHubSetup();

        const result = await jupyterPasswordConnect.getPasswordConnectionInfo('http://TESTNAME:8888/', fetchMock);
        assert.ok(result, 'No hub connection info');
        assert.equal(result?.remappedBaseUrl, 'http://testname:8888/user/test', 'Url not remapped');
        assert.equal(result?.remappedToken, 'foobar', 'Token should be returned in URL');
        assert.ok(result?.requestHeaders, 'No request headers returned for jupyter hub');
    });
});
