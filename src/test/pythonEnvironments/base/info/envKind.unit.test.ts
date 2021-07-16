// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { getKindDisplayName, getPrioritizedEnvKinds } from '../../../../client/pythonEnvironments/base/info/envKind';

const KIND_NAMES: [PythonEnvKind, string][] = [
    // We handle PythonEnvKind.Unknown separately.
    [PythonEnvKind.System, 'system'],
    [PythonEnvKind.MacDefault, 'macDefault'],
    [PythonEnvKind.WindowsStore, 'winStore'],
    [PythonEnvKind.Pyenv, 'pyenv'],
    [PythonEnvKind.CondaBase, 'condaBase'],
    [PythonEnvKind.Poetry, 'poetry'],
    [PythonEnvKind.Custom, 'customGlobal'],
    [PythonEnvKind.OtherGlobal, 'otherGlobal'],
    [PythonEnvKind.Venv, 'venv'],
    [PythonEnvKind.VirtualEnv, 'virtualenv'],
    [PythonEnvKind.VirtualEnvWrapper, 'virtualenvWrapper'],
    [PythonEnvKind.Pipenv, 'pipenv'],
    [PythonEnvKind.Conda, 'conda'],
    [PythonEnvKind.OtherVirtual, 'otherVirtual'],
];

suite('pyenvs info - PyEnvKind', () => {
    test('all Python env kinds are covered', () => {
        assert.equal(
            KIND_NAMES.length,
            // We ignore PythonEnvKind.Unknown.
            getNamesAndValues(PythonEnvKind).length - 1,
        );
    });

    suite('getKindDisplayName()', () => {
        suite('known', () => {
            KIND_NAMES.forEach(([kind]) => {
                if (kind === PythonEnvKind.OtherGlobal || kind === PythonEnvKind.OtherVirtual) {
                    return;
                }
                test(`check ${kind}`, () => {
                    const name = getKindDisplayName(kind);

                    assert.notEqual(name, '');
                });
            });
        });

        suite('not known', () => {
            [
                PythonEnvKind.Unknown,
                PythonEnvKind.OtherGlobal,
                PythonEnvKind.OtherVirtual,
                // Any other kinds that don't have clear display names go here.
            ].forEach((kind) => {
                test(`check ${kind}`, () => {
                    const name = getKindDisplayName(kind);

                    assert.equal(name, '');
                });
            });
        });
    });

    suite('getPrioritizedEnvKinds()', () => {
        test('all Python env kinds are covered', () => {
            const numPrioritized = getPrioritizedEnvKinds().length;
            const numNames = getNamesAndValues(PythonEnvKind).length;

            assert.equal(numPrioritized, numNames);
        });
    });
});
