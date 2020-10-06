// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
//import { isEqual as areDeepEqual } from 'lodash';
import * as path from 'path';
//import { EventEmitter } from 'vscode';
import { getOSType, OSType } from '../../../../../client/common/utils/platform';
import { PythonEnvInfo } from '../../../../../client/pythonEnvironments/base/info';
//import { PythonEnvInfo, PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { PythonLocatorQuery } from '../../../../../client/pythonEnvironments/base/locator';
//import { PythonEnvUpdatedEvent, PythonLocatorQuery } from '../../../../../client/pythonEnvironments/base/locator';
import {
    WindowsKnownPathsLocator,
} from '../../../../../client/pythonEnvironments/base/locators/lowLevel/windowsKnownPathsLocator';
//import { PythonEnvsChangedEvent } from '../../../../../client/pythonEnvironments/base/watcher';
//import { sleep } from '../../../../core';
import { getEnvs } from '../../common';
//import { createNamedEnv, getEnvs } from '../../common';

const ENV_VAR = getOSType() === OSType.Windows ? 'Path' : 'PATH';

suite('Python envs locator - WindowsKnownPathsLocator', () => {
    let oldPATH: string | undefined;

    setup(function () {
        if (getOSType() !== OSType.Windows) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }

        oldPATH = process.env[ENV_VAR];
    });
    teardown(() => {
        process.env[ENV_VAR] = oldPATH;
    });

    function setPATH(dirnames: string[]): void {
        process.env[ENV_VAR] = dirnames.join(path.delimiter);
    }

    suite('onChanged()', () => {
        test('', async () => {
        });
    });

    suite('iterEnvs()', () => {
        test('', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = new WindowsKnownPathsLocator();
            const query: PythonLocatorQuery | undefined = undefined;
            setPATH([]);

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });
    });

    suite('resolveEnv()', () => {
        test('', async () => {
        });
    });
});
