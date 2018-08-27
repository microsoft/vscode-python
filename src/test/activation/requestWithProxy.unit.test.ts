// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as request from 'request';
import { RequestWithProxy } from '../../client/activation/requestWithProxy';

suite('Activation - RequestWithProxy', () => {

    test('Supports download via proxy', async () => {
        let proxyValue: string = 'https://myproxy.net:4242';
        let requestWithProxy: RequestWithProxy = new RequestWithProxy(proxyValue);
        let opts: request.CoreOptions | undefined = requestWithProxy.requestOptions;
        assert.notEqual(opts, undefined, 'Expected to get options back from .getRequestOptions but got undefined');
        assert.equal(opts!.proxy, proxyValue, `Expected to see proxy service uri set to "${proxyValue}" but got "${opts!.proxy}" instead.`);

        proxyValue = '';
        requestWithProxy = new RequestWithProxy(proxyValue);
        opts = requestWithProxy.requestOptions;
        assert.equal(opts, undefined, 'Expected to get no options back from .getRequestOptions but got some options anyway!');
    });
});
