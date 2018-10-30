// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../ioc/types';
import { DataScience } from './datascience';
import { DataScienceCodeLensProvider } from './editor-integration/codelensprovider';
import { HistoryCommandListener } from './historycommandlistener';
import { HistoryProvider } from './historyProvider';
import { JupyterServerProvider } from './jupyterserverprovider';
import { IDataScience, IDataScienceCodeLensProvider, IDataScienceCommandListener, IHistoryProvider, IJupyterServerProvider  } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, DataScienceCodeLensProvider);
    serviceManager.addSingleton<IDataScience>(IDataScience, DataScience);
    serviceManager.addSingleton<IJupyterServerProvider>(IJupyterServerProvider, JupyterServerProvider);
    serviceManager.add<IDataScienceCommandListener>(IDataScienceCommandListener, HistoryCommandListener);
    serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
}
