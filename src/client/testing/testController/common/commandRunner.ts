// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as http from 'http';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IPythonExecutionFactory,
    SpawnOptions,
} from '../../../common/process/types';
import { createDeferred } from '../../../common/utils/async';
import { TestCommandOptions } from '../../common/types';

/**
 * Helper function that will send the unittest discovery command, wait for a reply from the Python script, and return the data.
 * It is up to the caller to parse this data into a JSON object.
 */
export async function runTestCommand(
    executionFactory: IPythonExecutionFactory,
    options: TestCommandOptions,
): Promise<string> {
    const deferred = createDeferred<string>();
    let server: http.Server;

    // Create the Python environment in which to execute the command.
    const creationOptions: ExecutionFactoryCreateWithEnvironmentOptions = {
        allowEnvironmentFetchExceptions: false,
        resource: options.workspaceFolder,
    };
    const execService = await executionFactory.createActivatedEnvironment(creationOptions);

    const spawnOptions: SpawnOptions = {
        token: options.token,
        cwd: options.cwd,
        throwOnStdErr: true,
    };

    // Handler to parse the request body.
    const requestListener: http.RequestListener = async (request, response) => {
        const buffers = [];

        for await (const chunk of request) {
            buffers.push(chunk);
        }

        const data = Buffer.concat(buffers).toString();

        // Close the connection.
        response.end();
        server.close();

        deferred.resolve(data);
    };

    // Create the server, and execute the Python command when it's ready.
    // The Python command will connect to the server, send its output back, and disconnect.
    // Once we receive the output, we can close the server (done in requestListener).
    server = http.createServer(requestListener);
    server.maxConnections = 1;

    server.listen(options.port, async () => {
        if (options.outChannel) {
            options.outChannel.appendLine(`python ${options.args.join(' ')}`);
        }

        try {
            await execService.exec(options.args, spawnOptions);
        } catch (ex) {
            deferred.reject(ex);
        }
    });

    return deferred.promise;
}
