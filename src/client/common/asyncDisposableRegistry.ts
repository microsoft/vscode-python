// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { IAsyncDisposableRegistry } from './types';
import { Disposables } from './utils/resourceLifecycle';

// List of disposables that need to run a promise.
@injectable()
export class AsyncDisposableRegistry extends Disposables implements IAsyncDisposableRegistry {}
