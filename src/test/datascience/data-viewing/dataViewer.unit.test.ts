// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ConfigurationChangeEvent, EventEmitter } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell, IWebPanelProvider, IWorkspaceService } from '../../../client/common/application/types';
import { WebPanelProvider } from '../../../client/common/application/webPanels/webPanelProvider';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { IConfigurationService } from '../../../client/common/types';
import { CodeCssGenerator } from '../../../client/datascience/codeCssGenerator';
import { DataViewer } from '../../../client/datascience/data-viewing/dataViewer';
import { JupyterVariableDataProvider } from '../../../client/datascience/data-viewing/jupyterVariableDataProvider';
import { IDataViewer, IDataViewerDataProvider } from '../../../client/datascience/data-viewing/types';
import { ThemeFinder } from '../../../client/datascience/themeFinder';
import { ICodeCssGenerator, IThemeFinder } from '../../../client/datascience/types';

suite('Data Science - DataViewer', () => {
    let dataViewer: IDataViewer;
    let webPanelProvider: IWebPanelProvider;
    let configService: IConfigurationService;
    let codeCssGenerator: ICodeCssGenerator;
    let themeFinder: IThemeFinder;
    let workspaceService: IWorkspaceService;
    let applicationShell: IApplicationShell;
    let dataProvider: IDataViewerDataProvider;
    const title: string = 'Data Viewer - Title';

    setup(async () => {
        webPanelProvider = mock(WebPanelProvider);
        configService = mock(ConfigurationService);
        codeCssGenerator = mock(CodeCssGenerator);
        themeFinder = mock(ThemeFinder);
        workspaceService = mock(WorkspaceService);
        applicationShell = mock(ApplicationShell);
        dataProvider = mock(JupyterVariableDataProvider);
        const settings = mock(PythonSettings);
        const settingsChangedEvent = new EventEmitter<void>();

        when(settings.onDidChange).thenReturn(settingsChangedEvent.event);
        when(configService.getSettings(anything())).thenReturn(instance(settings));

        const configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspaceService.onDidChangeConfiguration).thenReturn(configChangeEvent.event);

        dataViewer = new DataViewer(
            instance(webPanelProvider),
            instance(configService),
            instance(codeCssGenerator),
            instance(themeFinder),
            instance(workspaceService),
            instance(applicationShell),
            false
        );
    });
    test('Data viewer showData calls gets dataFrame info from data provider', async () => {
        await dataViewer.showData(instance(dataProvider), title);

        verify(dataProvider.getDataFrameInfo()).once();
    });
    test('Data viewer calls data provider dispose', async () => {
        await dataViewer.showData(instance(dataProvider), title);
        dataViewer.dispose();

        verify(dataProvider.dispose()).once();
    });
});
