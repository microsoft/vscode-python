// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

export interface IExtensionActivator {
  activate(context: vscode.ExtensionContext): Promise<boolean>;
  deactivate(): Promise<void>;
}
