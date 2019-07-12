// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import * as assert from 'assert';
import { expect } from 'chai';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { HttpClient } from '../../../client/common/net/httpClient';
import { createDeferred } from '../../../client/common/utils/async';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line: max-func-body-length
suite('Http Client', () => {
    const proxy = 'https://myproxy.net:4242';
    let config: TypeMoq.IMock<WorkspaceConfiguration>;
    let workSpaceService: TypeMoq.IMock<IWorkspaceService>;
    let container: TypeMoq.IMock<IServiceContainer>;
    let httpClient: HttpClient;
    setup(() => {
        container = TypeMoq.Mock.ofType<IServiceContainer>();
        workSpaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        config
            .setup(c => c.get(TypeMoq.It.isValue('proxy'), TypeMoq.It.isValue('')))
            .returns(() => proxy)
            .verifiable(TypeMoq.Times.once());
        workSpaceService
            .setup(w => w.getConfiguration(TypeMoq.It.isValue('http')))
            .returns(() => config.object)
            .verifiable(TypeMoq.Times.once());
        container.setup(a => a.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workSpaceService.object);

        httpClient = new HttpClient(container.object);
    });
    test('Get proxy info', async () => {
        expect(httpClient.requestOptions).to.deep.equal({ proxy: proxy });
        config.verifyAll();
        workSpaceService.verifyAll();
    });
    // tslint:disable-next-line: max-func-body-length
    suite('Test getJSON()', async () => {
        teardown(() => {
            sinon.restore();
            rewiremock.disable();
        });
        [
            {
                name: 'Throw error if request returns with download error',
                returnedArgs: ['downloadError', { statusCode: 201 }, undefined],
                expectedErrorMessage: 'downloadError'
            },
            {
                name: 'Throw error if request does not return with status code 200',
                returnedArgs: [undefined, { statusCode: 201, statusMessage: 'wrongStatus' }, undefined],
                expectedErrorMessage: 'Failed with status 201, wrongStatus, Uri downloadUri'
            },
            {
                name: 'If strict is set to true, and parsing fails, throw error',
                returnedArgs: [undefined, { statusCode: 200 }, '[{ "strictJSON" : true,, }]'],
                strict: true
            }
        ].forEach(async testParams => {
            test(testParams.name, async () => {
                const requestMock = (_uri: any, _requestOptions: any, callBackFn: Function) => callBackFn(...testParams.returnedArgs);
                rewiremock.enable();
                rewiremock('request').with(requestMock);
                let rejected = true;
                try {
                    await httpClient.getJSON('downloadUri', testParams.strict);
                    rejected = false;
                } catch (ex) {
                    if (testParams.expectedErrorMessage) {
                        // Compare error messages
                        if (ex.message) {
                            ex = ex.message;
                        }
                        expect(ex).to.equal(testParams.expectedErrorMessage, 'Promise rejected with the wrong error message');
                    }
                }
                assert(rejected === true, 'Promise should be rejected');
            });
        });

        [
            {
                name: 'If strict is set to false, and jsonc parsing returns error codes, then log errors and don\'t throw, return json',
                returnedArgs: [undefined, { statusCode: 200 }, '[{ "strictJSON" : false,, }]'],
                strict: false,
                expectedJSON: [{ strictJSON: false }]
            },
            {
                name: 'Return expected json if strict is set to true and parsing is successful',
                returnedArgs: [undefined, { statusCode: 200 }, '[{ "strictJSON" : true }]'],
                strict: true,
                expectedJSON: [{ strictJSON: true }]
            },
            {
                name: 'Return expected json if strict is set to false and parsing is successful',
                returnedArgs: [undefined, { statusCode: 200 }, '[{ //Comment \n "strictJSON" : false }]'],
                strict: false,
                expectedJSON: [{ strictJSON: false }]
            }
        ].forEach(async testParams => {
            test(testParams.name, async () => {
                const requestMock = (_uri: any, _requestOptions: any, callBackFn: Function) => callBackFn(...testParams.returnedArgs);
                rewiremock.enable();
                rewiremock('request').with(requestMock);
                let json;
                try {
                    json = await httpClient.getJSON('downloadUri', testParams.strict);
                } catch (ex) {
                    assert(false, 'Promise should not be rejected');
                }
                assert.deepEqual(json, testParams.expectedJSON, 'Unexpected JSON returned');
            });
        });

        test('Return expected json if downloading body completes within timeout', async () => {
            const getBodyDeferred = createDeferred<string>();
            const getBody = sinon.stub(HttpClient.prototype, 'getBody');
            getBody.callsFake(() => getBodyDeferred.promise);
            const parseBodyToJSON = sinon.stub(HttpClient.prototype, 'parseBodyToJSON');
            parseBodyToJSON.callsFake(() => Promise.resolve([{ json: true }]));

            httpClient = new HttpClient(container.object);

            // Download set to complete in 50 ms, timeout is of 150 ms, i.e download will complete within timeout
            const timer = setTimeout(() => getBodyDeferred.resolve('[{ "json" : true }]'), 50);
            const json = await httpClient.getJSON('downloadUri', true, 150);
            assert.deepEqual(json, [{ json: true }], 'Unexpected JSON returned');
            assert.ok(parseBodyToJSON.calledOnce);
            clearTimeout(timer);
        });

        test('Return \'null\' if downloading body fails to complete within timeout', async () => {
            const getBodyDeferred = createDeferred<string>();
            const getBody = sinon.stub(HttpClient.prototype, 'getBody');
            getBody.callsFake(() => getBodyDeferred.promise);
            const parseBodyToJSON = sinon.stub(HttpClient.prototype, 'parseBodyToJSON');
            parseBodyToJSON.callsFake(() => Promise.resolve([{ json: true }]));

            httpClient = new HttpClient(container.object);

            // Download set to complete in 200 ms, timeout is of 100 ms, i.e download will not complete within timeout
            const timer = setTimeout(() => getBodyDeferred.resolve('[{ "json" : true }]'), 200);
            const json = await httpClient.getJSON('downloadUri', true, 100);
            assert.deepEqual(json, null, 'Unexpected JSON returned');
            assert.ok(parseBodyToJSON.notCalled);
            clearTimeout(timer);
        });

        test('Throw error if downloading body fails with error when timeout is provided', async () => {
            const getBody = sinon.stub(HttpClient.prototype, 'getBody');
            getBody.callsFake(() => Promise.reject('Kaboom'));
            const parseBodyToJSON = sinon.stub(HttpClient.prototype, 'parseBodyToJSON');
            parseBodyToJSON.callsFake(() => Promise.resolve([{ json: true }]));

            httpClient = new HttpClient(container.object);

            await expect(httpClient.getJSON('downloadUri', true, 100)).to.eventually.be.rejectedWith('Kaboom');
            assert.ok(parseBodyToJSON.notCalled);
        });
    });
});
