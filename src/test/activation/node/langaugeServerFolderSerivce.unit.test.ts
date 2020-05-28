// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import {
    NodeLanguageServerFolderService,
    NodeLanguageServerVersionKey
} from '../../../client/activation/node/languageServerFolderService';
import { BundledLanguageServerFolder } from '../../../client/activation/types';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable:max-func-body-length

suite('Node Language Server Folder Service', () => {
    const resource = Uri.parse('a');
    const version = '0.0.1-test';

    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let workspaceConfiguration: TypeMoq.IMock<WorkspaceConfiguration>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let appEnvironment: TypeMoq.IMock<IApplicationEnvironment>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        configService.setup((c) => c.getSettings(undefined)).returns(() => pythonSettings.object);
        workspaceConfiguration = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup((ws) => ws.getConfiguration('python', TypeMoq.It.isAny()))
            .returns(() => workspaceConfiguration.object);
        appEnvironment = TypeMoq.Mock.ofType<IApplicationEnvironment>();
    });

    test('With packageName set', () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: version }));
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => 'somePackageName');

        const folderService = new NodeLanguageServerFolderService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            appEnvironment.object
        );

        expect(folderService.bundledVersion).to.be.equal(undefined, 'expected bundledVersion to be undefined');
        expect(folderService.isBundled()).to.be.equal(false, 'isBundled should be false');
    });

    test('Invalid version', () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: 'fakeversion' }));
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);

        const folderService = new NodeLanguageServerFolderService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            appEnvironment.object
        );

        expect(folderService.bundledVersion).to.be.equal(undefined, 'expected bundledVersion to be undefined');
        expect(folderService.isBundled()).to.be.equal(false, 'isBundled should be false');
    });

    test('downloadLanguageServer set to false', () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => false);
        appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: 'fakeversion' }));
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);

        const folderService = new NodeLanguageServerFolderService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            appEnvironment.object
        );

        expect(folderService.bundledVersion).to.be.equal(undefined, 'expected bundledVersion to be undefined');
        expect(folderService.isBundled()).to.be.equal(false, 'isBundled should be false');
    });

    suite('Valid configuration', () => {
        let folderService: NodeLanguageServerFolderService;

        setup(() => {
            pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
            appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: version }));
            workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);
            folderService = new NodeLanguageServerFolderService(
                serviceContainer.object,
                configService.object,
                workspaceService.object,
                appEnvironment.object
            );
        });

        test('isBundled is true', () => {
            expect(folderService.isBundled()).to.be.equal(true, 'isBundled should be true');
        });

        test('Parsed version is correct', () => {
            expect(folderService.bundledVersion!.format()).to.be.equal(version);
        });

        test('getLanguageServerFolderName', async () => {
            const folderName = await folderService.getLanguageServerFolderName(resource);
            expect(folderName).to.be.equal(BundledLanguageServerFolder);
        });

        test('getLatestLanguageServerVersion', async () => {
            const pkg = await folderService.getLatestLanguageServerVersion(resource);
            expect(pkg).to.equal(undefined, 'expected latest version to be undefined');
        });

        test('Method getCurrentLanguageServerDirectory()', async () => {
            const dir = await folderService.getCurrentLanguageServerDirectory();
            assert(dir);
            expect(dir!.path).to.equal(BundledLanguageServerFolder);
            expect(dir!.version.format()).to.be.equal(version);
        });
    });
});
