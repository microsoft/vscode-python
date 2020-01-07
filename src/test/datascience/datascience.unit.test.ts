// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import { instance, mock, verify, when } from 'ts-mockito';
import { CommandManager } from '../../client/common/application/commandManager';
import { DocumentManager } from '../../client/common/application/documentManager';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { CommandRegistry } from '../../client/datascience/commands/commandRegistry';
import { DataScience } from '../../client/datascience/datascience';
import { DataScienceCodeLensProvider } from '../../client/datascience/editor-integration/codelensprovider';
import { IDataScienceCodeLensProvider } from '../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('Data Science Tests', () => {
    let dataScience: DataScience;
    let cmdManager: CommandManager;
    let codeLensProvider: IDataScienceCodeLensProvider;
    let configService: IConfigurationService;
    let docManager: IDocumentManager;
    let workspaceService: IWorkspaceService;
    let cmdRegistry: CommandRegistry;
    let settings: IPythonSettings;
    let onDidChangeSettings: sinon.SinonStub;
    let onDidChangeActiveTextEditor: sinon.SinonStub;
    setup(() => {
        cmdManager = mock(CommandManager);
        codeLensProvider = mock(DataScienceCodeLensProvider);
        configService = mock(ConfigurationService);
        workspaceService = mock(WorkspaceService);
        cmdRegistry = mock(CommandRegistry);
        docManager = mock(DocumentManager);
        settings = mock(PythonSettings);

        dataScience = new DataScience(
            instance(cmdManager),
            // tslint:disable-next-line: no-any
            [] as any,
            // tslint:disable-next-line: no-any
            { subscriptions: [] } as any,
            instance(codeLensProvider),
            instance(configService),
            instance(docManager),
            instance(workspaceService),
            instance(cmdRegistry)
        );

        onDidChangeSettings = sinon.stub();
        onDidChangeActiveTextEditor = sinon.stub();
        when(configService.getSettings()).thenReturn(instance(settings));
        when(settings.onDidChange).thenReturn(onDidChangeSettings);
        // tslint:disable-next-line: no-any
        when(settings.datascience).thenReturn({} as any);
        when(docManager.onDidChangeActiveTextEditor).thenReturn(onDidChangeActiveTextEditor);
    });

    suite('Activate', () => {
        setup(async () => {
            await dataScience.activate();
        });

        test('Should register commands', async () => {
            verify(cmdRegistry.register()).once();
        });
        test('Should add handler for Settings Changed', async () => {
            assert.ok(onDidChangeSettings.calledOnce);
        });
        test('Should add handler for ActiveTextEditorChanged', async () => {
            assert.ok(onDidChangeActiveTextEditor.calledOnce);
        });
    });
});
