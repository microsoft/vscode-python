// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { LanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import { IDownloadChannelRule, ILanguageServerPackageService } from '../../../client/activation/types';
import { IConfigurationService } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('xLanguage Server Folder Service', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let languageServerFolderService: LanguageServerFolderService;
    const resource = Uri.parse('a');

    suite('Method getLanguageServerFolderName()', async () => {
        // tslint:disable-next-line: no-any
        let shouldLookForNewLS: sinon.SinonStub<any>;
        // tslint:disable-next-line: no-any
        let getCurrentLanguageServerDirectory: sinon.SinonStub<any>;
        const currentLSDirectory = {
            path: 'path/to/currentLSDirectoryName',
            version: new SemVer('1.2.3')
        };
        let languageServerPackageService: TypeMoq.IMock<ILanguageServerPackageService>;
        setup(() => {
            languageServerPackageService = TypeMoq.Mock.ofType<ILanguageServerPackageService>();
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            serviceContainer
                .setup(s => s.get<ILanguageServerPackageService>(ILanguageServerPackageService))
                .returns(() => languageServerPackageService.object);
        });
        teardown(() => {
            sinon.restore();
        });

        test('Returns current Language server directory name if rule says we should not look for new LS', async () => {
            shouldLookForNewLS = sinon.stub(LanguageServerFolderService.prototype, 'shouldLookForNewLanguageServer');
            shouldLookForNewLS.resolves(false);
            getCurrentLanguageServerDirectory = sinon.stub(LanguageServerFolderService.prototype, 'getCurrentLanguageServerDirectory');
            getCurrentLanguageServerDirectory.resolves(currentLSDirectory);
            languageServerFolderService = new LanguageServerFolderService(serviceContainer.object);
            const lsFolderName = await languageServerFolderService.getLanguageServerFolderName(resource);
            expect(lsFolderName).to.equal('currentLSDirectoryName');
        });

        test('Returns current Language server directory name if fetching latest LS version returns undefined', async () => {
            shouldLookForNewLS = sinon.stub(LanguageServerFolderService.prototype, 'shouldLookForNewLanguageServer');
            shouldLookForNewLS.resolves(true);
            languageServerPackageService
                .setup(l => l.getLatestNugetPackageVersion(resource))
                // tslint:disable-next-line: no-any
                .returns(() => Promise.resolve(undefined) as any);
            getCurrentLanguageServerDirectory = sinon.stub(LanguageServerFolderService.prototype, 'getCurrentLanguageServerDirectory');
            getCurrentLanguageServerDirectory.resolves(currentLSDirectory);
            languageServerFolderService = new LanguageServerFolderService(serviceContainer.object);
            const lsFolderName = await languageServerFolderService.getLanguageServerFolderName(resource);
            expect(lsFolderName).to.equal('currentLSDirectoryName');
        });

        test('Returns current Language server directory name if fetched latest LS version is less than the current LS version', async () => {
            shouldLookForNewLS = sinon.stub(LanguageServerFolderService.prototype, 'shouldLookForNewLanguageServer');
            shouldLookForNewLS.resolves(true);
            const nugetPackage = {
                package: 'packageName',
                version: new SemVer('1.1.3'),
                uri: 'nugetUri'
            };
            languageServerPackageService
                .setup(l => l.getLatestNugetPackageVersion(resource))
                .returns(() => Promise.resolve(nugetPackage));
            getCurrentLanguageServerDirectory = sinon.stub(LanguageServerFolderService.prototype, 'getCurrentLanguageServerDirectory');
            getCurrentLanguageServerDirectory.resolves(currentLSDirectory);
            languageServerFolderService = new LanguageServerFolderService(serviceContainer.object);
            const lsFolderName = await languageServerFolderService.getLanguageServerFolderName(resource);
            expect(lsFolderName).to.equal('currentLSDirectoryName');
        });

        test('Returns expected Language server directory name otherwise', async () => {
            shouldLookForNewLS = sinon.stub(LanguageServerFolderService.prototype, 'shouldLookForNewLanguageServer');
            shouldLookForNewLS.resolves(true);
            const nugetPackage = {
                package: 'packageName',
                version: new SemVer('1.3.2'),
                uri: 'nugetUri'
            };
            languageServerPackageService
                .setup(l => l.getLatestNugetPackageVersion(resource))
                .returns(() => Promise.resolve(nugetPackage));
            getCurrentLanguageServerDirectory = sinon.stub(LanguageServerFolderService.prototype, 'getCurrentLanguageServerDirectory');
            getCurrentLanguageServerDirectory.resolves(currentLSDirectory);
            languageServerFolderService = new LanguageServerFolderService(serviceContainer.object);
            const lsFolderName = await languageServerFolderService.getLanguageServerFolderName(resource);
            expect(lsFolderName).to.equal('languageServer.1.3.2');
        });
    });

    suite('Method shouldLookForNewLanguageServer()', async () => {
        let configurationService: TypeMoq.IMock<IConfigurationService>;
        let lsPackageService: TypeMoq.IMock<ILanguageServerPackageService>;
        let downloadChannelRule: TypeMoq.IMock<IDownloadChannelRule>;
        const currentLSDirectory = {
            path: 'path/to/currentLSDirectoryName',
            version: new SemVer('1.2.3')
        };
        setup(() => {
            configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
            lsPackageService = TypeMoq.Mock.ofType<ILanguageServerPackageService>();
            downloadChannelRule = TypeMoq.Mock.ofType<IDownloadChannelRule>();
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            serviceContainer
                .setup(s => s.get<IConfigurationService>(IConfigurationService))
                .returns(() => configurationService.object);
            serviceContainer
                .setup(s => s.get<IDownloadChannelRule>(IDownloadChannelRule, 'beta'))
                .returns(() => downloadChannelRule.object);
            serviceContainer
                .setup(s => s.get<ILanguageServerPackageService>(ILanguageServerPackageService))
                .returns(() => lsPackageService.object);
            lsPackageService
                .setup(l => l.getLanguageServerDownloadChannel())
                .returns(() => 'beta');
            languageServerFolderService = new LanguageServerFolderService(serviceContainer.object);
        });

        test(('If current folder is provided and setting `python.downloadLanguageServer` is set to false, return false'), async () => {
            const settings = {
                downloadLanguageServer: false,
                autoUpdateLanguageServer: true
            };
            configurationService
                .setup(c => c.getSettings())
                // tslint:disable-next-line: no-any
                .returns(() => settings as any);
            const result = await languageServerFolderService.shouldLookForNewLanguageServer(currentLSDirectory);
            expect(result).to.equal(false, 'Should be false');
        });

        test(('If current folder is provided and setting `python.autoUpdateLanguageServer` is set to false, return false'), async () => {
            const settings = {
                downloadLanguageServer: true,
                autoUpdateLanguageServer: false
            };
            configurationService
                .setup(c => c.getSettings())
                // tslint:disable-next-line: no-any
                .returns(() => settings as any);
            const result = await languageServerFolderService.shouldLookForNewLanguageServer(currentLSDirectory);
            expect(result).to.equal(false, 'Should be false');
        });

        test(('Otherwise, use rule to infer if we should look for LS'), async () => {
            const settings = {
                downloadLanguageServer: true,
                autoUpdateLanguageServer: false
            };
            configurationService
                .setup(c => c.getSettings())
                // tslint:disable-next-line: no-any
                .returns(() => settings as any);
            downloadChannelRule
                .setup(d => d.shouldLookForNewLanguageServer(undefined))
                .returns(() => Promise.resolve(true))
                .verifiable(TypeMoq.Times.once());
            const result = await languageServerFolderService.shouldLookForNewLanguageServer();
            expect(result).to.equal(true, 'Should be true');
            downloadChannelRule.verifyAll();
        });
    });
});
