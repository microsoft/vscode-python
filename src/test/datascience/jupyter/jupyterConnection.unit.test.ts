// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as events from 'events';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { CancellationToken } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { ObservableExecutionResult, Output } from '../../../client/common/process/types';
import { IConfigurationService, IDataScienceSettings } from '../../../client/common/types';
import { DataScience } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { JupyterConnectionWaiter, JupyterServerInfo } from '../../../client/datascience/jupyter/jupyterConnection';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable: max-func-body-length
suite('Data Science - JupyterConnection', () => {
    let observableOutput: Subject<Output<string>>;
    let launchResult: ObservableExecutionResult<string>;
    let getServerInfoStub: sinon.SinonStub<[CancellationToken | undefined], JupyterServerInfo[] | undefined>;
    let configService: IConfigurationService;
    let fs: IFileSystem;
    let serviceContainer: IServiceContainer;
    // tslint:disable-next-line: no-any
    const dsSettings: IDataScienceSettings = { jupyterLaunchTimeout: 10_000 } as any;
    const childProc = new events.EventEmitter();
    const notebookDir = 'someDir';
    const dummyServerInfos: JupyterServerInfo[] = [
        {
            base_url: '1',
            hostname: '111',
            notebook_dir: 'a',
            password: true,
            pid: 1,
            port: 1243,
            secure: false,
            token: 'wow',
            url: 'url'
        },
        {
            base_url: '2',
            hostname: '22',
            notebook_dir: notebookDir,
            password: false,
            pid: 13,
            port: 4444,
            secure: true,
            token: 'wow2',
            url: 'url2'
        },
        {
            base_url: '22',
            hostname: '33',
            notebook_dir: 'c',
            password: false,
            pid: 15,
            port: 555,
            secure: true,
            token: 'wow3',
            url: 'url23'
        }
    ];
    const expectedServerInfo = dummyServerInfos[1];

    setup(() => {
        observableOutput = new Subject<Output<string>>();
        launchResult = {
            dispose: noop,
            out: observableOutput,
            // tslint:disable-next-line: no-any
            proc: childProc as any
        };
        getServerInfoStub = sinon.stub<[CancellationToken | undefined], JupyterServerInfo[] | undefined>();
        serviceContainer = mock(ServiceContainer);
        fs = mock(FileSystem);
        configService = mock(ConfigurationService);
        const settings = mock(PythonSettings);
        getServerInfoStub.resolves(dummyServerInfos);
        when(fs.arePathsSame(anything(), anything())).thenCall((path1, path2) => path1 === path2);
        when(settings.datascience).thenReturn(dsSettings);
        when(configService.getSettings(anything())).thenReturn(instance(settings));
        when(serviceContainer.get<IFileSystem>(IFileSystem)).thenReturn(instance(fs));
        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
    });

    function createConnectionWaiter(cancelToken?: CancellationToken) {
        return new JupyterConnectionWaiter(
            launchResult,
            notebookDir,
            // tslint:disable-next-line: no-any
            getServerInfoStub as any,
            instance(serviceContainer),
            cancelToken
        );
    }
    test('Successfully gets connection info', async () => {
        dsSettings.jupyterLaunchTimeout = 10_000;
        const waiter = createConnectionWaiter();
        observableOutput.next({ source: 'stderr', out: 'Jupyter listening on http://123.123.123:8888' });

        const connection = await waiter.waitForConnection();

        assert.equal(connection.localLaunch, true);
        assert.equal(connection.allowUnauthorized, undefined);
        assert.equal(connection.localProcExitCode, undefined);
        assert.equal(connection.baseUrl, expectedServerInfo.url);
        assert.equal(connection.hostName, expectedServerInfo.hostname);
        assert.equal(connection.token, expectedServerInfo.token);
    });
    test('Disconnect event is fired in connection', async () => {
        dsSettings.jupyterLaunchTimeout = 10_000;
        const waiter = createConnectionWaiter();
        observableOutput.next({ source: 'stderr', out: 'Jupyter listening on http://123.123.123:8888' });
        let disconnected = false;

        const connection = await waiter.waitForConnection();
        connection.disconnected(() => (disconnected = true));

        childProc.emit('exit', 999);

        assert.isTrue(disconnected);
        assert.equal(connection.localProcExitCode, 999);
    });
    test('Throw timeout error', async () => {
        dsSettings.jupyterLaunchTimeout = 10;
        const waiter = createConnectionWaiter();

        const promise = waiter.waitForConnection();

        await assert.isRejected(promise, DataScience.jupyterLaunchTimedOut());
    });
    test('Throw crashed error', async () => {
        const exitCode = 999;
        const waiter = createConnectionWaiter();

        const promise = waiter.waitForConnection();
        childProc.emit('exit', exitCode);
        observableOutput.complete();

        await assert.isRejected(promise, DataScience.jupyterServerCrashed().format(exitCode.toString()));
    });
});
