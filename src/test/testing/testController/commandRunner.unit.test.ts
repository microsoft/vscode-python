// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as http from 'http';
import { OutputChannel, Uri } from 'vscode';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { TestCommandOptions } from '../../../client/testing/common/types';
import { runTestCommand } from '../../../client/testing/testController/common/commandRunner';

suite('Python command runner', () => {
    let stubExecutionFactory: IPythonExecutionFactory;
    let stubExecService: IPythonExecutionService;

    setup(() => {
        stubExecService = ({
            exec: async (args: string[]) => {
                fakeExecutedScript(args.join(' '));
                return Promise.resolve({
                    stdout: '',
                });
            },
        } as unknown) as IPythonExecutionService;

        stubExecutionFactory = ({
            createActivatedEnvironment: async () => Promise.resolve(stubExecService),
        } as unknown) as IPythonExecutionFactory;
    });

    // Fake Python script called by the runTestCommand function.
    // This function will parse the command arg for the server port, and the mock data to return.
    function fakeExecutedScript(command: string): void {
        // Parse data
        const args = command.split(' ');
        const portIndex = args.indexOf('--port');
        const dataIndex = args.indexOf('--data');

        const port = args[portIndex + 1];
        const data = args[dataIndex + 1];

        // Return data
        const options = {
            hostname: 'localhost',
            port,
            method: 'POST',
        };
        const request = http.request(options);
        request.write(JSON.stringify({ data }));
        request.end();
    }

    function buildCommandOptions(data = 'foo', port = 6789): TestCommandOptions {
        return {
            workspaceFolder: Uri.parse('foo'),
            port,
            cwd: 'foo',
            args: ['scriptName', '--port', `${port}`, '--data', data],
            ignoreCache: true,
        };
    }

    test('Should resolve with a string if the command was successful', async () => {
        const options = buildCommandOptions();

        const result = await runTestCommand(stubExecutionFactory, options);

        assert.strictEqual(result, '{"data":"foo"}');
    });

    test('Should reject the promise if the command failed', async () => {
        const options = buildCommandOptions();

        stubExecService = ({
            exec: async () => Promise.reject(new Error('foo')),
        } as unknown) as IPythonExecutionService;

        assert.rejects(runTestCommand(stubExecutionFactory, options));
    });

    test('Should write in an output channel if the outputChannel option was passed', async () => {
        let output = '';

        const stubOutputChannel: OutputChannel = ({
            appendLine: (line: string) => {
                output += line;
            },
        } as unknown) as OutputChannel;

        const data = 'bar';
        const options = buildCommandOptions(data);
        options.outChannel = stubOutputChannel;

        await runTestCommand(stubExecutionFactory, options);

        assert.strictEqual(output, `python scriptName --port ${options.port} --data ${data}`);
    });

    test('Should close the server if the command was successful', async () => {
        // Run runTestCommand
        const port = 6788;
        const options = buildCommandOptions('foo', port);

        await runTestCommand(stubExecutionFactory, options);

        // Try to create a server listening to the same port
        const server = http.createServer();
        server.listen(port);

        assert.ok(server.listening);

        // Close that server
        server.close();
    });

    test('Should close the server if the command failed', async () => {
        // Run runTestCommand
        const port = 6788;
        const options = buildCommandOptions('foo', port);

        stubExecService = ({
            exec: async () => Promise.reject(new Error('foo')),
        } as unknown) as IPythonExecutionService;

        assert.rejects(runTestCommand(stubExecutionFactory, options));

        // Try to create a server listening to the same port
        const server = http.createServer();
        server.listen(port);

        assert.ok(server.listening);

        // Close that server
        server.close();
    });
});
