// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { injectable } from 'inversify';
import { Event, Extension, extensions } from 'vscode';

import { IExtensions } from '../../client/common/types';

@injectable()
export class MockExtensions implements IExtensions {
    public all: Extension<any>[] = [];
    public getExtension<T>(_extensionId: string): Extension<T> | undefined {
        return undefined;
    }

    public get onDidChange(): Event<void> {
        return extensions.onDidChange;
    }
}
