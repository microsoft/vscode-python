// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import {
    getKind,
    getKindDisplayName,
    getKindName,
    getPrioritizedEnvKinds,
} from '../../../../client/pythonEnvironments/base/info/envKind';

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

    suite('getKindName()', () => {
        suite('known', () => {
            KIND_NAMES.forEach(([kind, expected]) => {
                test(`check ${kind}`, () => {
                    const name = getKindName(kind);

                    assert.equal(name, expected);
                });
            });
        });

        test('not known', () => {
            const kind = PythonEnvKind.Unknown;

            const name = getKindName(kind);

            assert.equal(name, '');
        });
    });

    suite('getKind()', () => {
        suite('known', () => {
            KIND_NAMES.forEach(([expected, name]) => {
                test(`check ${name}`, () => {
                    const kind = getKind(name);

                    assert.equal(kind, expected);
                });
            });
        });

        suite('not known', () => {
            [
                '',
                'unknown',
            ].forEach((name) => {
                test(`check ${name}`, () => {
                    const kind = getKind(name);

                    assert.equal(kind, undefined);
                });
            });
        });
    });

    suite('getKindDisplayName()', () => {
        suite('known', () => {
            KIND_NAMES.forEach(([kind]) => {
                test(`check ${kind}`, () => {
                    const name = getKindDisplayName(kind);

                    assert.notEqual(name, '');
                });
            });
        });

        test('not known', () => {
            const kind = PythonEnvKind.Unknown;

            const name = getKindDisplayName(kind);

            assert.equal(name, '???');
        });
    });

    suite('getPrioritizedEnvKinds()', () => {
        test('all Python env kinds are covered', () => {
            assert.equal(
                getPrioritizedEnvKinds().length,
                getNamesAndValues(PythonEnvKind).length,
            );
        });
    });
});
