// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any
import * as net from 'net';

// tslint:disable: prefer-template no-console no-function-expression

suite('MYONE', () => {
    function getPipeName() {
        if (process.platform === 'win32') {
            const PIPE_NAME = 'mypipe';
            return '\\\\.\\pipe\\' + PIPE_NAME;
        }
        return '/tmp/test.sock';
    }
    test('Test debug launcher args (no-wait)', async () => {
        return new Promise((resolve, reject) => {
            try {
                const PIPE_PATH = getPipeName();

                const server = net.createServer(function (stream) {
                    console.log('Server: on connection')

                    stream.on('data', function (c) {
                        console.log('Server: on data:', c.toString());
                    });

                    stream.on('end', function () {
                        console.log('Server: on end');
                        server.close();
                    });

                    stream.write('Take it easy!');
                });

                server.on('close', function () {
                    console.log('Server: on close');
                });

                server.listen(PIPE_PATH, function () {
                    console.log('Server: on listening');
                });

                // == Client part == //
                const client = net.connect(PIPE_PATH, function () {
                    console.log('Client: on connection');
                });

                client.on('data', function (data) {
                    console.log('Client: on data:', data.toString());
                    client.end('Thanks!');
                });

                client.on('end', function () {
                    console.log('Client: on end');
                    resolve();
                });
            } catch (ex) {
                reject(ex);
            }
        });
    }).timeout(60_000);
});
