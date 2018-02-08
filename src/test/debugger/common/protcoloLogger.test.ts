// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PassThrough } from 'stream';
import * as TypeMoq from 'typemoq';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem } from '../../../client/common/platform/types';
import { ProtocolLogger } from '../../../client/debugger/Common/protocolLogger';
import { IProtocolLogger } from '../../../client/debugger/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Debugging - Protocol Logger', () => {
    let protocolLogger: IProtocolLogger;
    const logFile = path.join(__dirname, 'created_for_testing_dummy.txt');
    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => new FileSystem(new PlatformService()));
        protocolLogger = new ProtocolLogger(serviceContainer.object);
        cleanTestFiles();
    });
    teardown(cleanTestFiles);
    function cleanTestFiles() {
        if (fs.existsSync(logFile)) {
            fs.unlinkSync(logFile);
        }
    }
    test('Ensure messages are buffered untill log file is provided', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);

        inputStream.write('A');
        outputStream.write('1');

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        protocolLogger.logToFile(logFile);

        const expectedLogFileContents = ['From Client:\nA', 'To Client:\n1',
            'From Client:\nB', 'From Client:\nC',
            'To Client:\n2', 'To Client:\n3\n'].join('\n');

        const fileContents = await fs.readFile(logFile, { encoding: 'utf8' });
        // We're going to ignore the first line of the log file as it contains the date.
        const fileContentsWithoutFirstLine = fileContents.split('\n').filter((line, index) => index > 0).join('\n');
        expect(fileContentsWithoutFirstLine).to.be.equal(expectedLogFileContents);
    });
    test('Ensure messages are are logged as they arrive', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);

        inputStream.write('A');
        outputStream.write('1');

        protocolLogger.logToFile(logFile);

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        const expectedLogFileContents = ['From Client:\nA', 'To Client:\n1',
            'From Client:\nB', 'From Client:\nC',
            'To Client:\n2', 'To Client:\n3\n'].join('\n');

        const fileContents = await fs.readFile(logFile, { encoding: 'utf8' });
        // We're going to ignore the first line of the log file as it contains the date.
        const fileContentsWithoutFirstLine = fileContents.split('\n').filter((line, index) => index > 0).join('\n');
        expect(fileContentsWithoutFirstLine).to.be.equal(expectedLogFileContents);
    });
    test('Ensure nothing is logged once logging is disabled', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);
        protocolLogger.logToFile(logFile);

        inputStream.write('A');
        outputStream.write('1');

        protocolLogger.disable();

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        const expectedLogFileContents = ['From Client:\nA', 'To Client:\n1\n'].join('\n');

        const fileContents = await fs.readFile(logFile, { encoding: 'utf8' });
        // We're going to ignore the first line of the log file as it contains the date.
        const fileContentsWithoutFirstLine = fileContents.split('\n').filter((line, index) => index > 0).join('\n');
        expect(fileContentsWithoutFirstLine).to.be.equal(expectedLogFileContents);
    });
    test('Ensure logFile method throws an exception once logging has been disabled', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);
        protocolLogger.disable();

        expect(protocolLogger.logToFile.bind(protocolLogger, logFile)).throws();
    });
    test('Ensure logFile is created when logging has been disabled', async () => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();

        protocolLogger.connect(inputStream, outputStream);
        protocolLogger.disable();

        expect(protocolLogger.logToFile.bind(protocolLogger, logFile)).throws();

        inputStream.write('A');
        outputStream.write('1');

        inputStream.write('B');
        inputStream.write('C');

        outputStream.write('2');
        outputStream.write('3');

        expect(fs.existsSync(logFile)).to.be.equal(false, 'log file should not be created');
    });
});
