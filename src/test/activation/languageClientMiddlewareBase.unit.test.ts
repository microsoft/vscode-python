// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CancellationTokenSource, Uri } from 'vscode';
import { ConfigurationRequest } from 'vscode-languageclient';
import { LanguageClientMiddlewareBase } from '../../client/activation/languageClientMiddlewareBase';
import { LanguageServerType } from '../../client/activation/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';

suite('LanguageClientMiddlewareBase', () => {
    test('uses exact interpreter lookup only for Python file configuration scopes', async () => {
        const getActiveInterpreter = sinon.stub().resolves({ path: '/env/python' });
        const getEnvironmentVariables = sinon.stub().resolves({});
        const serviceContainer = ({
            get: (service: symbol) => {
                if (service === IInterpreterService) {
                    return { getActiveInterpreter };
                }
                if (service === IEnvironmentVariablesProvider) {
                    return { getEnvironmentVariables };
                }
                throw new Error(`Unexpected service: ${service.toString()}`);
            },
        } as unknown) as IServiceContainer;
        const middleware = new LanguageClientMiddlewareBase(serviceContainer, LanguageServerType.Node, sinon.stub());
        const next = sinon.stub().resolves([{}, {}]) as ConfigurationRequest.HandlerSignature;
        const script = Uri.file('/workspace/script.py');
        const workspace = Uri.file('/workspace');
        const tokenSource = new CancellationTokenSource();

        const result = await middleware.workspace.configuration(
            {
                items: [
                    { section: 'python', scopeUri: script.toString() },
                    { section: 'python', scopeUri: workspace.toString() },
                ],
            },
            tokenSource.token,
            next,
        );

        expect(result).to.deep.equal([{ pythonPath: '/env/python' }, { pythonPath: '/env/python' }]);
        expect(getActiveInterpreter.firstCall.args[0].toString()).to.equal(script.toString());
        expect(getActiveInterpreter.firstCall.args[1]).to.deep.equal({ exactResource: true });
        expect(getActiveInterpreter.secondCall.args[0].toString()).to.equal(workspace.toString());
        expect(getActiveInterpreter.secondCall.args[1]).to.equal(undefined);
        tokenSource.dispose();
    });
});
