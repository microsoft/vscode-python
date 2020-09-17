import { assert } from 'chai';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvKind } from '../../../client/pythonEnvironments/base/info';
import { PythonEnvsReducer } from '../../../client/pythonEnvironments/collection/environmentsReducer';
import {
    createLocatedEnv, getEnvs, SimpleLocator,
} from '../base/common';

suite('Environments Reducer', () => {
    test('Duplicated incoming environments from locator manager are removed', async () => {
        const env1 = createLocatedEnv('path/to/env1', '3.5.12b1', PythonEnvKind.Venv);
        const env2 = createLocatedEnv('path/to/env2', '3.8.1', PythonEnvKind.Conda);
        const env3 = createLocatedEnv('path/to/env3', '2.7', PythonEnvKind.System);
        const env4 = createLocatedEnv('path/to/env2', '3.9.0rc2', PythonEnvKind.Pyenv);
        const env5 = createLocatedEnv('path/to/env1', '3.8', PythonEnvKind.System);
        const environments = [env1, env2, env3, env4, env5];
        const pythonEnvManager = new SimpleLocator(environments);

        const reducer = new PythonEnvsReducer(pythonEnvManager);

        const iterator = reducer.iterEnvs();
        const envs = await getEnvs(iterator);

        const expected = [env1, env2, env3];
        assert.deepEqual(envs.sort(), expected.sort());
    });
});
