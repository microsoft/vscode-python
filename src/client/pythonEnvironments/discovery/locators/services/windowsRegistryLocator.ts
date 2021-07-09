// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../../../../common/logger';
import { PythonEnvKind } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getRegistryInterpreters } from '../../../common/windowsUtils';

export class WindowsRegistryLocator extends Locator {
    // eslint-disable-next-line class-methods-use-this
    public iterEnvs(): IPythonEnvsIterator {
        const iterator = async function* () {
            const interpreters = await getRegistryInterpreters(true);
            for (const interpreter of interpreters) {
                try {
                    const env = buildEnvInfo({
                        kind: PythonEnvKind.OtherGlobal,
                        executable: interpreter.interpreterPath,
                    });
                    yield env;
                } catch (ex) {
                    traceError(`Failed to process environment: ${interpreter}`, ex);
                }
            }
        };
        return iterator();
    }
}
