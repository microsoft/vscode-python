// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as commandRunner from '../../../../client/testing/testController/common/commandRunner';
import { IPythonExecutionFactory } from '../../../../client/common/process/types';
import { IConfigurationService } from '../../../../client/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../../client/testing/testController/unittest/testDiscoveryAdapter';

suite('Unittest test discovery adapter', () => {
    let stubExecutionFactory: IPythonExecutionFactory;
    let stubConfigSettings: IConfigurationService;

    const sandbox = sinon.createSandbox();

    setup(() => {
        stubExecutionFactory = ({} as unknown) as IPythonExecutionFactory;

        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('discoverTests should return a JSON object if the command executed successfully', async () => {
        const stubRunTestCommand = sandbox.stub(commandRunner, 'runTestCommand');
        stubRunTestCommand.resolves('{"data":"something"}');

        const adapter = new UnittestTestDiscoveryAdapter(stubExecutionFactory, stubConfigSettings, 6789);

        const result = await adapter.discoverTests(Uri.parse('foo'));

        assert.deepStrictEqual(result, { data: 'something' });
    });

    test('discoverTests should throw an error if the command fails', async () => {
        const stubRunTestCommand = sandbox.stub(commandRunner, 'runTestCommand');
        stubRunTestCommand.rejects(new Error('an error'));

        const adapter = new UnittestTestDiscoveryAdapter(stubExecutionFactory, stubConfigSettings, 6789);

        assert.rejects(adapter.discoverTests(Uri.parse('foo')));
    });
});
