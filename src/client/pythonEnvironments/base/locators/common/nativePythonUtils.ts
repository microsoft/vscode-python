// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvKind } from '../../info';

export function categoryToKind(category?: string): PythonEnvKind {
    if (!category) {
        return PythonEnvKind.Unknown;
    }
    switch (category.toLowerCase()) {
        case 'conda':
            return PythonEnvKind.Conda;
        case 'system':
        case 'homebrew':
        case 'macpythonorg':
        case 'maccommandlinetools':
        case 'macxcode':
        case 'windowsregistry':
        case 'linuxglobal':
            return PythonEnvKind.System;
        case 'globalpaths':
            return PythonEnvKind.OtherGlobal;
        case 'pyenv':
            return PythonEnvKind.Pyenv;
        case 'poetry':
            return PythonEnvKind.Poetry;
        case 'pipenv':
            return PythonEnvKind.Pipenv;
        case 'pyenvvirtualenv':
            return PythonEnvKind.VirtualEnv;
        case 'venv':
            return PythonEnvKind.Venv;
        case 'virtualenv':
            return PythonEnvKind.VirtualEnv;
        case 'virtualenvwrapper':
            return PythonEnvKind.VirtualEnvWrapper;
        case 'windowsstore':
            return PythonEnvKind.MicrosoftStore;
        default:
            return PythonEnvKind.Unknown;
    }
}
