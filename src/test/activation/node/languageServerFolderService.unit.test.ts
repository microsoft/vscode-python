// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Extension, Uri, WorkspaceConfiguration } from 'vscode';
import {
    ILanguageServerFolder,
    ILSExtensionApi,
    NodeLanguageServerFolderService
} from '../../../client/activation/node/languageServerFolderService';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IConfigurationService, IExtensions, IPythonSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable:max-func-body-length

suite('Node Language Server Folder Service', () => {
    const resource = Uri.parse('a');
    const extensionName = 'some.extension';

    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let workspaceConfiguration: TypeMoq.IMock<WorkspaceConfiguration>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let extensions: TypeMoq.IMock<IExtensions>;

    class TestService extends NodeLanguageServerFolderService {
        // tslint:disable-next-line: no-unnecessary-override
        public languageServerFolder(): Promise<ILanguageServerFolder | undefined> {
            return super.languageServerFolder();
        }
    }

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
        extensions = TypeMoq.Mock.ofType<IExtensions>();
    });

    test('With packageName set', async () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => 'somePackageName');

        const folderService = new TestService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            extensions.object
        );

        const lsf = await folderService.languageServerFolder();
        expect(lsf).to.be.equal(undefined, 'expected languageServerFolder to be undefined');
        expect(await folderService.skipDownload()).to.be.equal(false, 'skipDownload should be false');
    });

    test('Invalid version', async () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);

        const folderService = new TestService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            extensions.object
        );

        const lsf = await folderService.languageServerFolder();
        expect(lsf).to.be.equal(undefined, 'expected languageServerFolder to be undefined');
        expect(await folderService.skipDownload()).to.be.equal(false, 'skipDownload should be false');
    });

    test('downloadLanguageServer set to false', async () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => false);
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);

        const folderService = new TestService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            extensions.object
        );

        const lsf = await folderService.languageServerFolder();
        expect(lsf).to.be.equal(undefined, 'expected languageServerFolder to be undefined');
        expect(await folderService.skipDownload()).to.be.equal(false, 'skipDownload should be false');
    });

    test('lsExtensionName is undefined', async () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);
        workspaceConfiguration.setup((wc) => wc.get('lsExtensionName')).returns(() => undefined);

        const folderService = new TestService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            extensions.object
        );

        const lsf = await folderService.languageServerFolder();
        expect(lsf).to.be.equal(undefined, 'expected languageServerFolder to be undefined');
        expect(await folderService.skipDownload()).to.be.equal(false, 'skipDownload should be false');
    });

    test('lsExtension not installed', async () => {
        pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);
        workspaceConfiguration.setup((wc) => wc.get('lsExtensionName')).returns(() => extensionName);
        extensions.setup((e) => e.getExtension(extensionName)).returns(() => undefined);

        const folderService = new TestService(
            serviceContainer.object,
            configService.object,
            workspaceService.object,
            extensions.object
        );

        const lsf = await folderService.languageServerFolder();
        expect(lsf).to.be.equal(undefined, 'expected languageServerFolder to be undefined');
        expect(await folderService.skipDownload()).to.be.equal(false, 'skipDownload should be false');
    });

    suite('Valid configuration', () => {
        const lsPath = '/some/absolute/path';
        const lsVersion = '0.0.1-test';
        const extensionApi: ILSExtensionApi = {
            languageServerFolder: async () => ({
                path: lsPath,
                version: lsVersion
            })
        };

        let folderService: TestService;
        let extension: TypeMoq.IMock<Extension<ILSExtensionApi>>;

        setup(() => {
            extension = TypeMoq.Mock.ofType<Extension<ILSExtensionApi>>();
            extension.setup((e) => e.activate()).returns(() => Promise.resolve(extensionApi));
            extension.setup((e) => e.exports).returns(() => extensionApi);
            pythonSettings.setup((p) => p.downloadLanguageServer).returns(() => true);
            workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);
            workspaceConfiguration.setup((wc) => wc.get('lsExtensionName')).returns(() => extensionName);
            extensions.setup((e) => e.getExtension(extensionName)).returns(() => extension.object);
            folderService = new TestService(
                serviceContainer.object,
                configService.object,
                workspaceService.object,
                extensions.object
            );
        });

        test('skipDownload is true', async () => {
            const skipDownload = await folderService.skipDownload();
            expect(skipDownload).to.be.equal(true, 'skipDownload should be true');
        });

        test('Parsed version is correct', async () => {
            const lsf = await folderService.languageServerFolder();
            assert(lsf);
            expect(lsf!.version.format()).to.be.equal(lsVersion);
            expect(lsf!.path).to.be.equal(lsPath);
        });

        test('getLanguageServerFolderName', async () => {
            const folderName = await folderService.getLanguageServerFolderName(resource);
            expect(folderName).to.be.equal(lsPath);
        });

        test('getLatestLanguageServerVersion', async () => {
            const pkg = await folderService.getLatestLanguageServerVersion(resource);
            expect(pkg).to.equal(undefined, 'expected latest version to be undefined');
        });

        test('Method getCurrentLanguageServerDirectory()', async () => {
            const dir = await folderService.getCurrentLanguageServerDirectory();
            assert(dir);
            expect(dir!.path).to.equal(lsPath);
            expect(dir!.version.format()).to.be.equal(lsVersion);
        });
    });
});
