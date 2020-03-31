// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as nodeFetch from 'node-fetch';
import * as typemoq from 'typemoq';

import { IApplicationShell } from '../../client/common/application/types';
import { JupyterPasswordConnect } from '../../client/datascience/jupyter/jupyterPasswordConnect';

// tslint:disable:no-any max-func-body-length
suite('JupyterPasswordConnect', () => {
    let jupyterPasswordConnect: JupyterPasswordConnect;
    let appShell: typemoq.IMock<IApplicationShell>;

    const xsrfValue: string = '12341234';
    const sessionName: string = 'sessionName';
    const sessionValue: string = 'sessionValue';

    setup(() => {
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        appShell.setup((a) => a.showInputBox(typemoq.It.isAny())).returns(() => Promise.resolve('Python'));
        jupyterPasswordConnect = new JupyterPasswordConnect(appShell.object);
    });

    test('getPasswordConnectionInfo', async () => {
        // Set up our fake node fetch
        const fetchMock: typemoq.IMock<typeof nodeFetch.default> = typemoq.Mock.ofInstance(nodeFetch.default);

        // Mock our first call to get xsrf cookie
        const mockXsrfResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockXsrfHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockXsrfHeaders
            .setup((mh) => mh.get('set-cookie'))
            .returns(() => `_xsrf=${xsrfValue}`)
            .verifiable(typemoq.Times.once());
        mockXsrfResponse
            .setup((mr) => mr.ok)
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        mockXsrfResponse
            .setup((mr) => mr.headers)
            .returns(() => mockXsrfHeaders.object)
            .verifiable(typemoq.Times.once());

        fetchMock
            .setup((fm) =>
                //tslint:disable-next-line:no-http-string
                fm('http://TESTNAME:8888/login?', {
                    method: 'get',
                    redirect: 'manual',
                    headers: { Connection: 'keep-alive' }
                })
            )
            .returns(() => Promise.resolve(mockXsrfResponse.object))
            .verifiable(typemoq.Times.once());

        // Mock our second call to get session cookie
        const mockSessionResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockSessionHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockSessionHeaders
            .setup((mh) => mh.get('set-cookie'))
            .returns(() => `${sessionName}=${sessionValue}`)
            .verifiable(typemoq.Times.once());
        mockSessionResponse
            .setup((mr) => mr.status)
            .returns(() => 302)
            .verifiable(typemoq.Times.once());
        mockSessionResponse
            .setup((mr) => mr.headers)
            .returns(() => mockSessionHeaders.object)
            .verifiable(typemoq.Times.once());

        // typemoq doesn't love this comparison, so generalize it a bit
        fetchMock
            .setup((fm) =>
                fm(
                    //tslint:disable-next-line:no-http-string
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
            .returns(() => Promise.resolve(mockSessionResponse.object))
            .verifiable(typemoq.Times.once());

        const result = await jupyterPasswordConnect.getPasswordConnectionInfo(
            //tslint:disable-next-line:no-http-string
            'http://TESTNAME:8888/',
            false,
            fetchMock.object
        );
        assert(result, 'Failed to get password');
        if (result) {
            assert(result.xsrfCookie === xsrfValue, 'Incorrect xsrf value');
            assert(result.sessionCookieName === sessionName, 'Incorrect session name');
            assert(result.sessionCookieValue === sessionValue, 'Incorrect session value');
        }

        // Verfiy calls
        mockXsrfHeaders.verifyAll();
        mockSessionHeaders.verifyAll();
        mockXsrfResponse.verifyAll();
        mockSessionResponse.verifyAll();
        fetchMock.verifyAll();
    });

    test('getPasswordConnectionInfo allowUnauthorized', async () => {
        // Set up our fake node fetch
        const fetchMock: typemoq.IMock<typeof nodeFetch.default> = typemoq.Mock.ofInstance(nodeFetch.default);

        // Mock our first call to get xsrf cookie
        const mockXsrfResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockXsrfHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockXsrfHeaders
            .setup((mh) => mh.get('set-cookie'))
            .returns(() => `_xsrf=${xsrfValue}`)
            .verifiable(typemoq.Times.once());
        mockXsrfResponse
            .setup((mr) => mr.ok)
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        mockXsrfResponse
            .setup((mr) => mr.headers)
            .returns(() => mockXsrfHeaders.object)
            .verifiable(typemoq.Times.once());

        //tslint:disable-next-line:no-http-string
        fetchMock
            .setup((fm) =>
                fm(
                    'https://TESTNAME:8888/login?',
                    typemoq.It.isObjectWith({
                        method: 'get',
                        headers: { Connection: 'keep-alive' }
                    })
                )
            )
            .returns(() => Promise.resolve(mockXsrfResponse.object))
            .verifiable(typemoq.Times.once());

        // Mock our second call to get session cookie
        const mockSessionResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockSessionHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockSessionHeaders
            .setup((mh) => mh.get('set-cookie'))
            .returns(() => `${sessionName}=${sessionValue}`)
            .verifiable(typemoq.Times.once());
        mockSessionResponse
            .setup((mr) => mr.status)
            .returns(() => 302)
            .verifiable(typemoq.Times.once());
        mockSessionResponse
            .setup((mr) => mr.headers)
            .returns(() => mockSessionHeaders.object)
            .verifiable(typemoq.Times.once());

        // typemoq doesn't love this comparison, so generalize it a bit
        //tslint:disable-next-line:no-http-string
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
            .returns(() => Promise.resolve(mockSessionResponse.object))
            .verifiable(typemoq.Times.once());

        //tslint:disable-next-line:no-http-string
        const result = await jupyterPasswordConnect.getPasswordConnectionInfo(
            'https://TESTNAME:8888/',
            true,
            fetchMock.object
        );
        assert(result, 'Failed to get password');
        if (result) {
            assert(result.xsrfCookie === xsrfValue, 'Incorrect xsrf value');
            assert(result.sessionCookieName === sessionName, 'Incorrect session name');
            assert(result.sessionCookieValue === sessionValue, 'Incorrect session value');
        }

        // Verfiy calls
        mockXsrfHeaders.verifyAll();
        mockSessionHeaders.verifyAll();
        mockXsrfResponse.verifyAll();
        mockSessionResponse.verifyAll();
        fetchMock.verifyAll();
    });

    test('getPasswordConnectionInfo failure', async () => {
        // Set up our fake node fetch
        const fetchMock: typemoq.IMock<typeof nodeFetch.default> = typemoq.Mock.ofInstance(nodeFetch.default);

        // Mock our first call to get xsrf cookie
        const mockXsrfResponse = typemoq.Mock.ofType(nodeFetch.Response);
        const mockXsrfHeaders = typemoq.Mock.ofType(nodeFetch.Headers);
        mockXsrfHeaders
            .setup((mh) => mh.get('set-cookie'))
            .returns(() => `_xsrf=${xsrfValue}`)
            .verifiable(typemoq.Times.never());
        // Status set to not ok and header fetch should not be hit
        mockXsrfResponse
            .setup((mr) => mr.ok)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        mockXsrfResponse
            .setup((mr) => mr.headers)
            .returns(() => mockXsrfHeaders.object)
            .verifiable(typemoq.Times.never());

        fetchMock
            .setup((fm) =>
                //tslint:disable-next-line:no-http-string
                fm('http://TESTNAME:8888/login?', {
                    method: 'get',
                    redirect: 'manual',
                    headers: { Connection: 'keep-alive' }
                })
            )
            .returns(() => Promise.resolve(mockXsrfResponse.object))
            .verifiable(typemoq.Times.once());

        const result = await jupyterPasswordConnect.getPasswordConnectionInfo(
            //tslint:disable-next-line:no-http-string
            'http://TESTNAME:8888/',
            false,
            fetchMock.object
        );
        assert(!result);

        // Verfiy calls
        mockXsrfHeaders.verifyAll();
        mockXsrfResponse.verifyAll();
        fetchMock.verifyAll();
    });
});
