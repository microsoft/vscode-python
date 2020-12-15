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
    [PythonEnvKind.Unknown, 'unknown'],
    [PythonEnvKind.System, 'system'],
    [PythonEnvKind.MacDefault, 'macDefault'],
    [PythonEnvKind.WindowsStore, 'winStore'],
    [PythonEnvKind.Pyenv, 'pyenv'],
    [PythonEnvKind.CondaBase, 'condaBase'],
    [PythonEnvKind.Poetry, 'poetry'],
    [PythonEnvKind.Custom, 'custom'],
    [PythonEnvKind.OtherGlobal, 'otherGlobal'],
    [PythonEnvKind.Venv, 'venv'],
    [PythonEnvKind.VirtualEnv, 'virtualenv'],
    [PythonEnvKind.VirtualEnvWrapper, 'virtualenvWrapper'],
    [PythonEnvKind.Pipenv, 'pipenv'],
    [PythonEnvKind.Conda, 'conda'],
    [PythonEnvKind.OtherVirtual, 'otherVirtual'],
];

test('all Python env kinds are covered', () => {
    assert.equal(
        KIND_NAMES.length,
        getNamesAndValues(PythonEnvKind).length,
    );
});

suite('pyenvs info - getKindName()', () => {
    suite('known', () => {
        KIND_NAMES.forEach(([kind, expected]) => {
            test(`check ${kind}`, () => {
                const name = getKindName(kind);

                assert.equal(name, expected);
            });
        });
    });
});

suite('pyenvs info - getKind()', () => {
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
        ].forEach((name) => {
            test(`check ${name}`, () => {
                const kind = getKind(name);

                assert.equal(kind, PythonEnvKind.Unknown);
            });
        });
    });
});

suite('pyenvs info - getKindDisplayName()', () => {
    suite('known', () => {
        KIND_NAMES.forEach(([kind]) => {
            test(`check ${kind}`, () => {
                const name = getKindDisplayName(kind);

                assert.notEqual(name, '');
            });
        });
    });
});

suite('pyenvs info - getPrioritizedEnvKinds()', () => {
    test('all Python env kinds are covered', () => {
        assert.equal(
            getPrioritizedEnvKinds().length,
            getNamesAndValues(PythonEnvKind).length,
        );
    });
});
