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
import { NodeLanguageServerFolder } from '../../../client/activation/types';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable:max-func-body-length

suite('Node Language Server Folder Service', () => {
    const resource = Uri.parse('a');
    const version = '0.0.1-test';

    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceConfiguration: TypeMoq.IMock<WorkspaceConfiguration>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let appEnvironment: TypeMoq.IMock<IApplicationEnvironment>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceConfiguration = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup((ws) => ws.getConfiguration('python', TypeMoq.It.isAny()))
            .returns(() => workspaceConfiguration.object);
        appEnvironment = TypeMoq.Mock.ofType<IApplicationEnvironment>();
    });

    test('With packageName set', () => {
        appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: version }));
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => 'somePackageName');

        const folderService = new NodeLanguageServerFolderService(
            serviceContainer.object,
            workspaceService.object,
            appEnvironment.object
        );

        expect(folderService.bundledVersion).to.be.equal(undefined, 'expected bundledVersion to be undefined');
    });

    test('Invalid version', () => {
        appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: 'fakeversion' }));
        workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);

        const folderService = new NodeLanguageServerFolderService(
            serviceContainer.object,
            workspaceService.object,
            appEnvironment.object
        );

        expect(folderService.bundledVersion).to.be.equal(undefined, 'expected bundledVersion to be undefined');
    });

    suite('Valid configuration', () => {
        let folderService: NodeLanguageServerFolderService;

        setup(() => {
            appEnvironment.setup((e) => e.packageJson).returns(() => ({ [NodeLanguageServerVersionKey]: version }));
            workspaceConfiguration.setup((wc) => wc.get('packageName')).returns(() => undefined);
            folderService = new NodeLanguageServerFolderService(
                serviceContainer.object,
                workspaceService.object,
                appEnvironment.object
            );
        });

        test('Parsed version is correct', () => {
            expect(folderService.bundledVersion!.format()).to.be.equal(version);
        });

        test('getLanguageServerFolderName', async () => {
            const folderName = await folderService.getLanguageServerFolderName(resource);
            expect(folderName).to.be.equal(NodeLanguageServerFolder);
        });

        test('getLatestLanguageServerVersion', async () => {
            const pkg = await folderService.getLatestLanguageServerVersion(resource);
            expect(pkg).to.equal(undefined, 'expected latest version to be undefined');
        });

        test('Method getCurrentLanguageServerDirectory()', async () => {
            const dir = await folderService.getCurrentLanguageServerDirectory();
            assert(dir);
            expect(dir!.path).to.equal(NodeLanguageServerFolder);
            expect(dir!.version.format()).to.be.equal(version);
        });
    });
});
