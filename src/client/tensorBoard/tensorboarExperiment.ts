// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { extensions } from 'vscode';

export function useNewTensorboardExtension(): boolean {
    return !!extensions.getExtension('ms-toolsai.tensorboard');
}
