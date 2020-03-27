// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { IApplicationShell } from '../../client/common/application/types';
import { ConfigurationService } from '../../client/common/configuration/service';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { ProcessService } from '../../client/common/process/proc';
import { IProcessService, IProcessServiceFactory, Output } from '../../client/common/process/types';
import { IConfigurationService, IOutputChannel, IPythonSettings } from '../../client/common/types';
import { Generator } from '../../client/workspaceSymbols/generator';
use(chaiAsPromised);

// tslint:disable-next-line:max-func-body-length
suite('Workspace Symbols Generator', () => {
    let configurationService: IConfigurationService;
    let pythonSettings: typemoq.IMock<IPythonSettings>;
    let generator: Generator;
    let factory: typemoq.IMock<IProcessServiceFactory>;
    let shell: IApplicationShell;
    let processService: IProcessService;
    let fs: IFileSystem;
    const folderUri = Uri.parse(path.join('a', 'b', 'c'));
    setup(() => {
        pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        configurationService = mock(ConfigurationService);
        factory = typemoq.Mock.ofType<IProcessServiceFactory>();
        shell = mock(ApplicationShell);
        fs = mock(FileSystem);
        processService = mock(ProcessService);
        factory.setup((f) => f.create(typemoq.It.isAny())).returns(() => Promise.resolve(instance(processService)));
        when(configurationService.getSettings(anything())).thenReturn(pythonSettings.object);
        const outputChannel = typemoq.Mock.ofType<IOutputChannel>();
        generator = new Generator(
            folderUri,
            outputChannel.object,
            instance(shell),
            instance(fs),
            factory.object,
            instance(configurationService)
        );
    });
    test('should be disabled', () => {
        const workspaceSymbols = { enabled: false } as any;
        pythonSettings.setup((p) => p.workspaceSymbols).returns(() => workspaceSymbols);

        expect(generator.enabled).to.be.equal(false, 'not disabled');
    });
    test('should be enabled', () => {
        const workspaceSymbols = { enabled: true } as any;
        pythonSettings.setup((p) => p.workspaceSymbols).returns(() => workspaceSymbols);

        expect(generator.enabled).to.be.equal(true, 'not enabled');
    });
    test('Check tagFilePath', () => {
        const workspaceSymbols = { tagFilePath: '1234' } as any;
        pythonSettings.setup((p) => p.workspaceSymbols).returns(() => workspaceSymbols);

        expect(generator.tagFilePath).to.be.equal('1234');
    });
    test('Throw error when generating tags', async () => {
        const ctagsPath = 'CTAG_PATH';
        const workspaceSymbols = {
            enabled: true,
            tagFilePath: '1234',
            exclusionPatterns: [],
            ctagsPath,
        } as any;
        pythonSettings.setup((p) => p.workspaceSymbols).returns(() => workspaceSymbols);
        when(fs.directoryExists(anything())).thenResolve(true);
        const observable = {
            out: {
                subscribe: (cb: (out: Output<string>) => void, _errorCb: any, done: Function) => {
                    cb({ source: 'stderr', out: 'KABOOM' });
                    done();
                },
            },
        };
        when(processService.execObservable(ctagsPath, anything(), anything())).thenReturn(observable as any);

        const promise = generator.generateWorkspaceTags();
        await expect(promise).to.eventually.be.rejectedWith('KABOOM');
        verify(shell.setStatusBarMessage(anything(), anything())).once();
    });
    test('Does not throw error when generating tags', async () => {
        const ctagsPath = 'CTAG_PATH';
        const workspaceSymbols = {
            enabled: true,
            tagFilePath: '1234',
            exclusionPatterns: [],
            ctagsPath,
        } as any;
        pythonSettings.setup((p) => p.workspaceSymbols).returns(() => workspaceSymbols);
        when(fs.directoryExists(anything())).thenResolve(true);
        const observable = {
            out: {
                subscribe: (cb: (out: Output<string>) => void, _errorCb: any, done: Function) => {
                    cb({ source: 'stdout', out: '' });
                    done();
                },
            },
        };
        when(processService.execObservable(ctagsPath, anything(), anything())).thenReturn(observable as any);

        await generator.generateWorkspaceTags();
        verify(shell.setStatusBarMessage(anything(), anything())).once();
    });
});
