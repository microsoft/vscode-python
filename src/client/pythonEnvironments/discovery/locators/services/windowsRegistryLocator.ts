// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../../../../common/logger';
import { PythonEnvKind, PythonEnvSource } from '../../../base/info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getRegistryInterpreters } from '../../../common/windowsUtils';

export class WindowsRegistryLocator extends Locator<BasicEnvInfo> {
    // eslint-disable-next-line class-methods-use-this
    public iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const iterator = async function* () {
            const interpreters = await getRegistryInterpreters();
            for (const interpreter of interpreters) {
                try {
                    const env: BasicEnvInfo = {
                        kind: PythonEnvKind.OtherGlobal,
                        executablePath: interpreter.interpreterPath,
                        source: [PythonEnvSource.WindowsRegistry],
                    };
                    yield env;
                } catch (ex) {
                    traceError(`Failed to process environment: ${interpreter}`, ex);
                }
            }
        };
        return iterator();
    }
}
