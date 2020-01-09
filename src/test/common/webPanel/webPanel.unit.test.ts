// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as chai from 'chai';
import * as http from 'http';
import * as path from 'path';
import * as portfinder from 'portfinder';
import * as uuid from 'uuid/v4';

// tslint:disable-next-line: no-var-requires no-require-imports
import chaiHttp = require('chai-http');
chai.use(chaiHttp);

import { WebPanelServer } from '../../../client/common/application/webPanels/webPanelServer';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';

// tslint:disable:no-any
// tslint:disable-next-line: max-func-body-length
suite('WebPanelServer', () => {
    let host: WebPanelServer | undefined;
    let server: http.Server | undefined;
    const token = uuid();
    const historyBundle = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'history-react', 'index_bundle.js');
    setup(async () => {
        // So these are effectively functional tests rather than unit tests...
        const fs = new FileSystem();
        host = new WebPanelServer(await portfinder.getPortPromise(), token, fs);
        server = host.start();
    });

    teardown(() => {
        host?.dispose();
    });

    test('Server responds with html when given valid input', done => {
        chai.request(server)
            .get(`/${uuid()}?token=${token}&scripts=${encodeURIComponent(path.basename(historyBundle))}&rootPath=${encodeURIComponent(path.dirname(historyBundle))}`)
            .end((e, r) => {
                // tslint:disable-next-line: no-unused-expression
                chai.expect(e, 'Error is not null').to.be.null;
                chai.expect(r, 'Response status is not 200').to.have.status(200);
                chai.expect(r.text, 'Response does not have the script').to.include('index_bundle.js');
                done();
            });
    });

    test('Server responds with 404 when given invalid input', done => {
        chai.request(server)
            .get(`/${uuid()}?scripts=${encodeURIComponent(path.basename(historyBundle))}&rootPath=${encodeURIComponent(path.dirname(historyBundle))}`)
            .end((_e, r) => {
                // tslint:disable-next-line: no-unused-expression
                chai.expect(r, 'Response status is not 404').to.have.status(404);
                done();
            });
    });

    test('Server responds with 404 when given file not found', done => {
        const agent = chai.request(server).keepOpen();
        agent
            .get(`/${uuid()}?token=${token}&scripts=${encodeURIComponent(path.basename(historyBundle))}&rootPath=${encodeURIComponent(path.dirname(historyBundle))}`)
            .end((_e, r) => {
                // tslint:disable-next-line: no-unused-expression
                chai.expect(r, 'Response status is not 200 on first request').to.have.status(200);
                agent.get('/foobar.png').end((_e2, r2) => {
                    chai.expect(r2, 'Response status is not 404').to.have.status(404);
                    agent.close();
                    done();
                });
            });
    });

    test('Server can find the index_bundle', done => {
        // See here for where the code for this comes from (you might think keepOpen is required, but instead request.agent is used for multiple requests)
        // https://www.chaijs.com/plugins/chai-http/ and search 'Retaining cookies with each request'
        const agent = chai.request.agent(server);
        agent
            .get(`/${uuid()}?token=${token}&scripts=${encodeURIComponent(path.basename(historyBundle))}&rootPath=${encodeURIComponent(path.dirname(historyBundle))}`)
            .end((_e, r) => {
                // tslint:disable-next-line: no-unused-expression
                chai.expect(r, 'Response status is not 200 on first request').to.have.status(200);
                chai.expect(r, 'Response does not have a cookie').to.have.cookie('id');
                return agent.get('/index_bundle.js').end((_e2, r2) => {
                    chai.expect(r2, 'Response status is not 200').to.have.status(200);
                    agent.close();
                    done();
                });
            });
    });

    test('Server can find the a file in a cwd', done => {
        const agent = chai.request.agent(server);
        agent
            .get(
                `/${uuid()}?token=${token}&scripts=${encodeURIComponent(path.basename(historyBundle))}&rootPath=${encodeURIComponent(
                    path.dirname(historyBundle)
                )}&cwd=${encodeURIComponent(EXTENSION_ROOT_DIR)}`
            )
            .end((_e, r) => {
                // tslint:disable-next-line: no-unused-expression
                chai.expect(r, 'Response status is not 200 on first request').to.have.status(200);
                chai.expect(r, 'Response does not have a cookie').to.have.cookie('id');
                return agent.get('/package.json').end((_e2, r2) => {
                    chai.expect(r2, 'Response status is not 200').to.have.status(200);
                    agent.close();
                    done();
                });
            });
    });

    test('Server will skip a file not in the cwd', done => {
        const agent = chai.request.agent(server);
        agent
            .get(
                `/${uuid()}?token=${token}&scripts=${encodeURIComponent(path.basename(historyBundle))}&rootPath=${encodeURIComponent(
                    path.dirname(historyBundle)
                )}&cwd=${encodeURIComponent(EXTENSION_ROOT_DIR)}`
            )
            .end((_e, r) => {
                // tslint:disable-next-line: no-unused-expression
                chai.expect(r, 'Response status is not 200 on first request').to.have.status(200);
                chai.expect(r, 'Response does not have a cookie').to.have.cookie('id');
                return agent.get('/package_missing.json').end((_e2, r2) => {
                    chai.expect(r2, 'Response status is not 404').to.have.status(404);
                    agent.close();
                    done();
                });
            });
    });
});
