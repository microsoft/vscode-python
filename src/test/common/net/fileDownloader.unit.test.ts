// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as fsExtra from 'fs-extra';
import * as nock from 'nock';
import * as path from 'path';
// tslint:disable-next-line: match-default-export-name
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
import { noop} from '../../core';
// tslint:disable-next-line: no-var-requires no-require-imports
const requestProgress = require('request-progress');

// tslint:disable: max-func-body-length no-any
type ProgressReporterData = { message?: string; increment?: number };
class ErroringMemoryStream extends Writable {
    constructor(private readonly errorMessage = 'kaboom') {
        super();
    }
    public _write(_chunk: any, _encoding: any, callback: any) {
        super.emit('error', new Error(this.errorMessage));
        return callback();
    }
}
class DelayedReadMemoryStream extends Readable {
    public get readableLength() {
        return 1024 * 10;
    }
    private readCounter = 0;
    constructor(private readonly totalKb: number,
        private readonly delayMs: number,
        private readonly kbPerIteration: number) {
        super();
    }
    public _read() {
        // Delay reading data, mimicking slow file downloads.
        setTimeout(() => this.sendMesage(), this.delayMs);
    }
    public sendMesage() {
        const i = this.readCounter += 1;
        if (i > (this.totalKb / this.kbPerIteration)) {
            this.push(null);
        } else {
            this.push(Buffer.from('a'.repeat(this.kbPerIteration), 'ascii'));
        }
    }
}

suite('xFile Downloader', () => {
    let fileDownloader: FileDownloader;
    let httpClient: IHttpClient;
    let fs: IFileSystem;
    let appShell: IApplicationShell;
    suiteSetup(() => rewiremock.enable());
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
            when(httpClient.downloadFile(anything())).thenCall((uri: string) => {
                // tslint:disable-next-line: no-require-imports
                const request = require('request');
                return request(uri);
            });
            fs = new FileSystem(new PlatformService());
            appShell = mock(ApplicationShell);
        });
        teardown(() => {
            rewiremock.disable();
            sinon.restore();
        });
        test('File gets downloaded', async () => {
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => fsExtra.createReadStream(packageJsonFile));
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgress(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            const tmpFilePath = await fs.createTemporaryFile('.json');

            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            await fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', tmpFilePath.filePath);

            const expectedFileContents = fsExtra.readFileSync(packageJsonFile).toString();
            assert.equal(fsExtra.readFileSync(tmpFilePath.filePath).toString(), expectedFileContents);
        });
        test('Error is throw for http Status !== 200', async () => {
            nock('https://python.extension')
                .get('/package.json')
                .reply(500);
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgress(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            const tmpFilePath = await fs.createTemporaryFile('.json');

            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            const promise = fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', tmpFilePath.filePath);

            await expect(promise).to.eventually.be.rejectedWith('Failed with status 500, null, Uri https://python.extension/package.json');
        });
        test('Error is throw if unable to write to the file stream', async () => {
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => fsExtra.createReadStream(packageJsonFile));
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgress(anything(), anything())).thenCall((_, cb) => cb(progressReporter));

            const invalidFileName = new PlatformService().isWindows ? 'abcd:/bogusFile/one.txt' : '/bogus file path/.txt';
            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            const promise = fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', invalidFileName);

            await expect(promise).to.eventually.be.rejected;
        });
        test('Error is throw if file stream throws an error', async () => {
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => fsExtra.createReadStream(packageJsonFile));
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgress(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            const tmpFilePath = 'bogus file';
            const fileSystem = mock(FileSystem);
            const fileStream = new ErroringMemoryStream();
            when(fileSystem.createWriteStream(tmpFilePath)).thenReturn(fileStream as any);

            fileDownloader = new FileDownloader(instance(httpClient), instance(fileSystem), instance(appShell));
            const promise = fileDownloader.downloadFileWithStatusBarProgress(uri, 'hello', tmpFilePath);

            await expect(promise).to.eventually.be.rejectedWith('kaboom');
        });
        test('Report progress as file gets downloaded', async () => {
            const totalKb = 50;
            nock('https://python.extension')
                .get('/package.json')
                .reply(200, () => [200, new DelayedReadMemoryStream(1024 * totalKb, 5, 1024 * 10), { 'content-length': 1024 * totalKb }]);
            const progressReportStub = sinon.stub();
            const progressReporter: Progress<ProgressReporterData> = { report: progressReportStub };
            when(appShell.withProgress(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
            const tmpFilePath = await fs.createTemporaryFile('.json');
            // Mock request-progress to throttle 1ms, so we can get progress messages.
            rewiremock.enable();
            rewiremock('request-progress').with((reqUri: string) => requestProgress(reqUri, { throttle: 1 }));

            fileDownloader = new FileDownloader(instance(httpClient), fs, instance(appShell));
            await fileDownloader.downloadFileWithStatusBarProgress(uri, 'Downloading-something', tmpFilePath.filePath);

            // Since we are throttling the progress notifications for ever 1ms,
            // and we're delaying downloading by every 10ms, we'll have progress reported for every 1ms.
            // And we'll have a total of 5kb (based on counter in ReadMemoryStream).
            expect(progressReportStub.callCount).to.equal(5);
            expect(progressReportStub.args[0][0].message).to.equal(getProgressMessage(10, 20));
            expect(progressReportStub.args[1][0].message).to.equal(getProgressMessage(20, 40));
            expect(progressReportStub.args[2][0].message).to.equal(getProgressMessage(30, 60));
            expect(progressReportStub.args[3][0].message).to.equal(getProgressMessage(40, 80));
            expect(progressReportStub.args[4][0].message).to.equal(getProgressMessage(50, 100));

            function getProgressMessage(downloadedKb: number, percentage: number) {
                return Http.downloadingFileProgress().format('Downloading-something',
                    downloadedKb.toFixed(), totalKb.toFixed(), percentage.toString());
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
    // suite('Progress Reporter', () => {
    //     let requestProgress: ProgressReporter;
    //     const reporter: Progress<ProgressReporterData> = {} as any;
    //     const request: requestTypes.Request = {} as any;
    //     const fileStream: WriteStream = {} as any;
    //     let pipeStub: sinon.SinonStub<[NodeJS.WritableStream, ({ end?: boolean | undefined } | undefined)?], NodeJS.WritableStream>;
    //     httpClient = mock(HttpClient);
    //     fs = mock(FileSystem);
    //     appShell = mock(ApplicationShell);
    //     suiteSetup(() => pipeStub = sinon.stub(ProgressReporter.prototype, 'pipe'));
    //     setup(() => {
    //         fileDownloader = new FileDownloader(httpClient, fs, appShell);
    //         requestProgress = new ProgressReporter();
    //         rewiremock('request-progress').with(() => requestProgress);
    //     });
    //     teardown(() => pipeStub.restore());

    //     test('Ending progress report will resolve the promise', async () => {
    //         const promise = fileDownloader.displayDownloadProgress('uri', reporter, request, fileStream, '');
    //         const deferred = createDeferredFromPromise(promise);

    //         // Promise should not be resolved even after 100ms.
    //         await sleep(100);
    //         assert.ok(!deferred.completed);

    //         // Raise end event, then promise should resolve.
    //         requestProgress.emit('close');
    //         await sleep(1);
    //         assert.ok(deferred.completed);
    //         await expect(promise).to.eventually.be.equal(undefined, 'Incorrect value');
    //     });
    //     // test('Ending progress report with error will reject the promise', async () => {
    //     //     const promise = fileDownloader.displayDownloadProgress('uri', reporter, request, fileStream, '');
    //     //     const deferred = createDeferredFromPromise(promise);

    //     //     // We need this, else node complains about unhandled rejections.
    //     //     promise.ignoreErrors();
    //     //     deferred.promise.ignoreErrors();

    //     //     // Promise should not be resolved even after 100ms.
    //     //     await sleep(100);
    //     //     assert.ok(!deferred.completed);

    //     //     // Raise end event, then promise should get rejected.
    //     //     requestProgress.emit('error', new Error('kaboom'));
    //     //     await sleep(1);
    //     //     assert.ok(deferred.completed);
    //     //     await expect(promise).to.eventually.be.rejectedWith('kaboom');
    //     // });
    //     // test('Output from progress should be piped into filestream', async () => {
    //     //     const promise = fileDownloader.displayDownloadProgress('uri', reporter, request, fileStream, '');
    //     //     const deferred = createDeferredFromPromise(promise);

    //     //     assert.ok(pipeStub.calledOnceWithExactly(fileStream));
    //     //     requestProgress.emit('end');
    //     //     await sleep(1);
    //     //     assert.ok(deferred.completed);
    //     //     await expect(deferred.promise).to.eventually.be.equal(undefined, 'Incorrect value');
    //     // });
    //     // test('Progress is reported', async () => {
    //     //     let reportStub: sinon.SinonStub;
    //     //     reporter.report = reportStub = sinon.stub();
    //     //     const promise = fileDownloader.displayDownloadProgress('uri', reporter, request, fileStream, 'Hello World');

    //     //     assert.equal(reportStub.callCount, 0);

    //     //     const totalMB = 6;
    //     //     requestProgress.emit('progress', { size: { transferred: 2 * 1024, total: 1024 * totalMB }, percent: 10 / 100 });
    //     //     assert.equal(reportStub.callCount, 1);
    //     //     let message = Http.downloadingFileProgress().format('Hello World', '2', totalMB.toString(), '10');
    //     //     assert.ok(reportStub.calledOnceWithExactly({ message }));

    //     //     reportStub.reset();

    //     //     requestProgress.emit('progress', { size: { transferred: 5 * 1024, total: 1024 * totalMB }, percent: 90 / 100 });
    //     //     assert.equal(reportStub.callCount, 1);
    //     //     message = Http.downloadingFileProgress().format('Hello World', '5', totalMB.toString(), '90');
    //     //     assert.ok(reportStub.calledOnceWithExactly({ message }));

    //     //     requestProgress.emit('end');
    //     //     await sleep(1);
    //     //     await expect(promise).to.eventually.be.equal(undefined, 'Incorrect value');
    //     // });
    // });
});

