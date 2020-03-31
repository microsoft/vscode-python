// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PassThrough } from 'stream';
import * as TypeMoq from 'typemoq';
import { Logger } from 'vscode-debugadapter';
import { ProtocolLogger } from '../../../client/debugger/debugAdapter/Common/protocolLogger';
import { IProtocolLogger } from '../../../client/debugger/debugAdapter/types';

// tslint:disable-next-line:max-func-body-length
suite('Debugging - Protocol Logger', () => {
    let protocolLogger: IProtocolLogger;
    setup(() => {
        protocolLogger = new ProtocolLogger();
    });
    test('Ensure messages are buffered until logger is provided', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);

        inputStream.write('A');
        outputStream.write('1');

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        const logger = TypeMoq.Mock.ofType<Logger.Logger>();
        protocolLogger.setup(logger.object);

        logger.verify((l) => l.verbose('From Client:'), TypeMoq.Times.exactly(3));
        logger.verify((l) => l.verbose('To Client:'), TypeMoq.Times.exactly(3));

        const expectedLogFileContents = ['A', '1', 'B', 'C', '2', '3'];
        for (const expectedContent of expectedLogFileContents) {
            logger.verify((l) => l.verbose(expectedContent), TypeMoq.Times.once());
        }
    });
    test('Ensure messages are are logged as they arrive', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);

        inputStream.write('A');
        outputStream.write('1');

        const logger = TypeMoq.Mock.ofType<Logger.Logger>();
        protocolLogger.setup(logger.object);

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        logger.verify((l) => l.verbose('From Client:'), TypeMoq.Times.exactly(3));
        logger.verify((l) => l.verbose('To Client:'), TypeMoq.Times.exactly(3));

        const expectedLogFileContents = ['A', '1', 'B', 'C', '2', '3'];
        for (const expectedContent of expectedLogFileContents) {
            logger.verify((l) => l.verbose(expectedContent), TypeMoq.Times.once());
        }
    });
    test('Ensure nothing is logged once logging is disabled', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);
        const logger = TypeMoq.Mock.ofType<Logger.Logger>();
        protocolLogger.setup(logger.object);

        inputStream.write('A');
        outputStream.write('1');

        protocolLogger.dispose();

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        logger.verify((l) => l.verbose('From Client:'), TypeMoq.Times.exactly(1));
        logger.verify((l) => l.verbose('To Client:'), TypeMoq.Times.exactly(1));

        const expectedLogFileContents = ['A', '1'];
        const notExpectedLogFileContents = ['B', 'C', '2', '3'];

        for (const expectedContent of expectedLogFileContents) {
            logger.verify((l) => l.verbose(expectedContent), TypeMoq.Times.once());
        }
        for (const notExpectedContent of notExpectedLogFileContents) {
            logger.verify((l) => l.verbose(notExpectedContent), TypeMoq.Times.never());
        }
    });
});
