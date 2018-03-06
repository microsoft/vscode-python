// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { IPythonSettings } from '../common/types';
import { IServiceManager } from '../ioc/types';

export interface IExtensionActivator {
  activate(context: vscode.ExtensionContext, serviceManager: IServiceManager, pythonSettings: IPythonSettings): Promise<boolean>;
  deactivate(): Promise<void>;
}
