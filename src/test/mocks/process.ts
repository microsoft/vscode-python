// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import * as TypeMoq from 'typemoq';
import { ICurrentProcess } from '../../client/common/types';
import { EnvironmentVariables } from '../../client/common/variables/types';

@injectable()
export class MockProcess implements ICurrentProcess {
    constructor(public env: EnvironmentVariables = { ...process.env }) {}

    // eslint-disable-next-line @typescript-eslint/ban-types
    public on(_event: string | symbol, _listener: Function): this {
        return this;
    }

    // eslint-disable-next-line class-methods-use-this
    public get argv(): string[] {
        return [];
    }

    // eslint-disable-next-line class-methods-use-this
    public get stdout(): NodeJS.WriteStream {
        return TypeMoq.Mock.ofType<NodeJS.WriteStream>().object;
    }

    // eslint-disable-next-line class-methods-use-this
    public get stdin(): NodeJS.ReadStream {
        return TypeMoq.Mock.ofType<NodeJS.ReadStream>().object;
    }

    // eslint-disable-next-line class-methods-use-this
    public get execPath(): string {
        return '';
    }
}
