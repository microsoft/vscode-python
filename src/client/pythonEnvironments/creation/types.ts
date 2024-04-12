// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Progress, WorkspaceFolder } from 'vscode';

export interface CreateEnvironmentProgress extends Progress<{ message?: string; increment?: number }> {}

export interface CreateEnvironmentOptionsInternal {
    workspaceFolder?: WorkspaceFolder;
    providerId?: string;
}
