// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-var-requires no-require-imports max-func-body-length no-any match-default-export-name
import * as assert from 'assert';
import { expect } from 'chai';
import * as fsExtra from 'fs-extra';
import * as nock from 'nock';
import * as path from 'path';
import rewiremock from 'rewiremock';
import * as sinon from 'sinon';
import { Readable, Writable } from 'stream';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Progress } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../client/common/application/types';
import { FileDownloader } from '../../../client/common/net/fileDownloader';
import { HttpClient } from '../../../client/common/net/httpClient';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem } from '../../../client/common/platform/types';
import { IHttpClient } from '../../../client/common/types';
import { Http } from '../../../client/common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { noop } from '../../core';
import { MockOutputChannel } from '../../mockClasses';
const requestProgress = require('request-progress');
const request = require('request');

type ProgressReporterData = { message?: string; increment?: number };

/**
 * Writable stream that'll throw an error when written to.
 * (used to mimick errors thrown when writing to a file).
 *
 * @class ErroringMemoryStream
 * @extends {Writable}
 */
class ErroringMemoryStream extends Writable {
    constructor(private readonly errorMessage: string) {
        super();
    }
    public _write(_chunk: any, _encoding: any, callback: any) {
        super.emit('error', new Error(this.errorMessage));
        return callback();
    }
}
/**
 * Readable stream that's slow to return data.
 * (used to mimic slow file downloads).
 *
 * @class DelayedReadMemoryStream
 * @extends {Readable}
 */
class DelayedReadMemoryStream extends Readable {
    public get readableLength() {
        return 1024 * 10;
    }
    private readCounter = 0;
    constructor(
        private readonly totalKb: number,
        private readonly delayMs: number,
        private readonly kbPerIteration: number
    ) {
        super();
    }
    public _read() {
        // Delay reading data, mimicking slow file downloads.
        setTimeout(() => this.sendMesage(), this.delayMs);
    }
    public sendMesage() {
        const i = (this.readCounter += 1);
        if (i > this.totalKb / this.kbPerIteration) {
            this.push(null);
        } else {
            this.push(Buffer.from('a'.repeat(this.kbPerIteration), 'ascii'));
        }
    }
}

suite('File Downloader', () => {
    let fileDownloader: FileDownloader;
    let httpClient: IHttpClient;
    let fs: IFileSystem;
    let appShell: IApplicationShell;
    suiteTeardown(() => {
        rewiremock.disable();
        sinon.restore();
    });
    suite('File Downloader (real)', () => {
        const uri = 'https://python.extension/package.json';
        const packageJsonFile = path.join(EXTENSION_ROOT_DIR, 'package.json');
        setup(() => {
            rewiremock.disable();
            httpClient = mock(HttpClient);
            appShell = mock(ApplicationShell);
            when(httpClient.downloadFile(anything())).thenCall(request);
            fs = new FileSystem();
        });
        teardown(() => {
            rewiremock.disable();
            sinon.restore();
        });
        test('File gets downloaded', async () => {
            // When downloading a uri, point it to package.json file.
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => fsExtra.createReadStream(packageJsonFile));
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            const tmpFilePath = await fs.createTemporaryFile('.json');
            when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));

            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            await fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', tmpFilePath.filePath);

            // Confirm the package.json file gets downloaded
            const expectedFileContents = fsExtra.readFileSync(packageJsonFile).toString();
            assert.equal(fsExtra.readFileSync(tmpFilePath.filePath).toString(), expectedFileContents);
        });
        test('Error is throw for http Status !== 200', async () => {
            // When downloading a uri, throw status 500 error.
            nock('https://python.extension').get('/package.json').reply(500);
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            const tmpFilePath = await fs.createTemporaryFile('.json');

            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            const promise = fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', tmpFilePath.filePath);

            await expect(promise).to.eventually.be.rejectedWith(
                'Failed with status 500, null, Uri https://python.extension/package.json'
            );
        });
        test('Error is throw if unable to write to the file stream', async () => {
            // When downloading a uri, point it to package.json file.
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => fsExtra.createReadStream(packageJsonFile));
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));

            // Use bogus files that cannot be created (on windows, invalid drives, on mac & linux use invalid home directories).
            const invalidFileName = new PlatformService().isWindows
                ? 'abcd:/bogusFile/one.txt'
                : '/bogus file path/.txt';
            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            const promise = fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', invalidFileName);

            // Things should fall over.
            await expect(promise).to.eventually.be.rejected;
        });
        test('Error is throw if file stream throws an error', async () => {
            // When downloading a uri, point it to package.json file.
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => fsExtra.createReadStream(packageJsonFile));
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            // Create a file stream that will throw an error when written to (use ErroringMemoryStream).
            const tmpFilePath = 'bogus file';
            const fileSystem = mock(FileSystem);
            const fileStream = new ErroringMemoryStream('kaboom from fs');
            when(fileSystem.createWriteStream(tmpFilePath)).thenReturn(fileStream as any);

            fileDownloader = new FileDownloader(instance(httpClient), instance(fileSystem), instance(appShell));
            const promise = fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', tmpFilePath);

            // Confirm error from FS is bubbled up.
            await expect(promise).to.eventually.be.rejectedWith('kaboom from fs');
        });
        test('Report progress as file gets downloaded', async () => {
            const totalKb = 50;
            // When downloading a uri, point it to stream that's slow.
            // We'll return data from this stream slowly, mimicking a slow download.
            // When the download is slow, we can test progress.
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => [
                    200,
                    new DelayedReadMemoryStream(1024 * totalKb, 5, 1024 * 10),
                    { 'content-length': 1024 * totalKb }
                ]);
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            const tmpFilePath = await fs.createTemporaryFile('.json');
            // Mock request-progress to throttle 1ms, so we can get progress messages.
            // I.e. report progress every 1ms. (however since download is delayed to 10ms,
            // we'll get progress reported every 10ms. We use 1ms, to ensure its guaranteed
            // to be reported. Else changing it to 10ms could result in it being reported in 12ms
            rewiremock.enable();
            rewiremock('request-progress').with((reqUri: string) => requestProgress(reqUri, { throttle: 1 }));

            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            await fileDownloader.downloadFileWithStatusBarProgress(uri, 'Downloading-something', tmpFilePath.filePath);

            // Since we are throttling the progress notifications for ever 1ms,
            // and we're delaying downloading by every 10ms, we'll have progress reported for every 10ms.
            // So we'll have progress reported for every 10kb of data downloaded, for a total of 5 times.
            expect(progressReportStub.callCount).to.equal(5);
            expect(progressReportStub.args[0][0].message).to.equal(getProgressMessage(10, 20));
            expect(progressReportStub.args[1][0].message).to.equal(getProgressMessage(20, 40));
            expect(progressReportStub.args[2][0].message).to.equal(getProgressMessage(30, 60));
            expect(progressReportStub.args[3][0].message).to.equal(getProgressMessage(40, 80));
            expect(progressReportStub.args[4][0].message).to.equal(getProgressMessage(50, 100));

            function getProgressMessage(downloadedKb: number, percentage: number) {
                return Http.downloadingFileProgress().format(
                    'Downloading-something',
                    downloadedKb.toFixed(),
                    totalKb.toFixed(),
                    percentage.toString()
                );
            }
        });
    });
    suite('File Downloader (mocks)', () => {
        let downloadWithProgressStub: sinon.SinonStub<any>;
        setup(() => {
            httpClient = mock(HttpClient);
            fs = mock(FileSystem);
            appShell = mock(ApplicationShell);
            downloadWithProgressStub = sinon.stub(FileDownloader.prototype, 'displayDownloadProgress');
            downloadWithProgressStub.callsFake(() => Promise.resolve());
        });
        teardown(() => {
            sinon.restore();
        });
        test('Create temporary file and return path to that file', async () => {
            const tmpFile = { filePath: 'my temp file', dispose: noop };
            when(fs.createTemporaryFile('.pdf')).thenResolve(tmpFile);
            fileDownloader = new FileDownloader(instance(httpClient), instance(fs), instance(appShell));

            const file = await fileDownloader.downloadFile('file', { progressMessagePrefix: '', extension: '.pdf' });

            verify(fs.createTemporaryFile('.pdf')).once();
            assert.equal(file, 'my temp file');
        });
        test('Display progress message in output channel', async () => {
            const outputChannel = mock(MockOutputChannel);
            const tmpFile = { filePath: 'my temp file', dispose: noop };
            when(fs.createTemporaryFile('.pdf')).thenResolve(tmpFile);
            fileDownloader = new FileDownloader(instance(httpClient), instance(fs), instance(appShell));

            await fileDownloader.downloadFile('file to download', {
                progressMessagePrefix: '',
                extension: '.pdf',
                outputChannel: outputChannel
            });

            verify(outputChannel.appendLine(Http.downloadingFile().format('file to download')));
        });
        test('Display progress when downloading', async () => {
            const tmpFile = { filePath: 'my temp file', dispose: noop };
            when(fs.createTemporaryFile('.pdf')).thenResolve(tmpFile);
            const statusBarProgressStub = sinon.stub(FileDownloader.prototype, 'downloadFileWithStatusBarProgress');
            statusBarProgressStub.callsFake(() => Promise.resolve());
            fileDownloader = new FileDownloader(instance(httpClient), instance(fs), instance(appShell));

            await fileDownloader.downloadFile('file', { progressMessagePrefix: '', extension: '.pdf' });

            assert.ok(statusBarProgressStub.calledOnce);
        });
        test('Dispose temp file and bubble error thrown by status progress', async () => {
            const disposeStub = sinon.stub();
            const tmpFile = { filePath: 'my temp file', dispose: disposeStub };
            when(fs.createTemporaryFile('.pdf')).thenResolve(tmpFile);
            const statusBarProgressStub = sinon.stub(FileDownloader.prototype, 'downloadFileWithStatusBarProgress');
            statusBarProgressStub.callsFake(() => Promise.reject(new Error('kaboom')));
            fileDownloader = new FileDownloader(instance(httpClient), instance(fs), instance(appShell));

            const promise = fileDownloader.downloadFile('file', { progressMessagePrefix: '', extension: '.pdf' });

            await expect(promise).to.eventually.be.rejectedWith('kaboom');
            assert.ok(statusBarProgressStub.calledOnce);
            assert.ok(disposeStub.calledOnce);
        });
    });
});
