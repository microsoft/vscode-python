// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { Extension } from 'vscode';

import { IExtensions } from '../../client/common/types';

// tslint:disable:no-any unified-signatures

@injectable()
export class MockExtensions implements IExtensions {
    public all: Extension<any>[] = [];
    public getExtension<T>(extensionId: string) : Extension<T> | undefined {
        return undefined;
    }
}
