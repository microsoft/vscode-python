// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { LanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
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
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
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
            const serverVersion = sinon.stub(LanguageServerFolderService.prototype, 'getLatestLanguageServerVersion');
            serverVersion.resolves(undefined);
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
            const serverVersion = sinon.stub(LanguageServerFolderService.prototype, 'getLatestLanguageServerVersion');
            serverVersion.resolves(nugetPackage);
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
            const serverVersion = sinon.stub(LanguageServerFolderService.prototype, 'getLatestLanguageServerVersion');
            serverVersion.resolves(nugetPackage);
            getCurrentLanguageServerDirectory = sinon.stub(LanguageServerFolderService.prototype, 'getCurrentLanguageServerDirectory');
            getCurrentLanguageServerDirectory.resolves(currentLSDirectory);
            languageServerFolderService = new LanguageServerFolderService(serviceContainer.object);
            const lsFolderName = await languageServerFolderService.getLanguageServerFolderName(resource);
            expect(lsFolderName).to.equal('languageServer.1.3.2');
        });
    });
});
