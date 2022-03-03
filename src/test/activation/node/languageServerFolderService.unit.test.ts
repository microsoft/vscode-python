// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect, use } from 'chai';
import * as TypeMoq from 'typemoq';
import { Extension, Uri } from 'vscode';
import * as chaiAsPromised from 'chai-as-promised';
import {
    ILanguageServerFolder,
    ILSExtensionApi,
    NodeLanguageServerFolderService,
} from '../../../client/activation/node/languageServerFolderService';
import { PYLANCE_EXTENSION_ID } from '../../../client/common/constants';
import { IExtensions } from '../../../client/common/types';

use(chaiAsPromised);

suite('Node Language Server Folder Service', () => {
    const resource = Uri.parse('a');

    let extensions: TypeMoq.IMock<IExtensions>;

    class TestService extends NodeLanguageServerFolderService {
        public languageServerFolder(): Promise<ILanguageServerFolder | undefined> {
            return super.languageServerFolder();
        }
    }

    setup(() => {
        extensions = TypeMoq.Mock.ofType<IExtensions>();
    });

    test('Not installed', async () => {
        extensions.setup((e) => e.getExtension(PYLANCE_EXTENSION_ID)).returns(() => undefined);

        const folderService = new TestService(extensions.object);

        const lsf = await folderService.languageServerFolder();
        expect(lsf).to.be.equal(undefined, 'expected languageServerFolder to be undefined');
        expect(await folderService.skipDownload()).to.be.equal(false, 'skipDownload should be false');

        await expect(folderService.getCurrentLanguageServerDirectory()).to.eventually.rejected;
        await expect(folderService.getLanguageServerFolderName(resource)).to.eventually.rejected;
    });

    suite('Valid configuration', () => {
        const lsPath = '/some/absolute/path';
        const lsVersion = '0.0.1-test';
        const extensionApi: ILSExtensionApi = {
            languageServerFolder: async () => ({
                path: lsPath,
                version: lsVersion,
            }),
        };

        let folderService: TestService;
        let extension: TypeMoq.IMock<Extension<ILSExtensionApi>>;

        setup(() => {
            extension = TypeMoq.Mock.ofType<Extension<ILSExtensionApi>>();
            extension.setup((e) => e.activate()).returns(() => Promise.resolve(extensionApi));
            extension.setup((e) => e.exports).returns(() => extensionApi);
            extensions.setup((e) => e.getExtension(PYLANCE_EXTENSION_ID)).returns(() => extension.object);
            folderService = new TestService(extensions.object);
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

        test('Method getCurrentLanguageServerDirectory()', async () => {
            const dir = await folderService.getCurrentLanguageServerDirectory();
            assert(dir);
            expect(dir!.path).to.equal(lsPath);
            expect(dir!.version.format()).to.be.equal(lsVersion);
        });
    });
});
