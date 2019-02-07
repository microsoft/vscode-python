// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../client/common/application/types';

// tslint:disable:no-any unified-signatures

@injectable()
export class MockLiveShareApi implements ILiveShareApi {

    public getApi(): Promise<vsls.LiveShare | null> {
        return Promise.resolve(null);
    }
}
