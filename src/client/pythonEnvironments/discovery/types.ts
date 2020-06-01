// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export enum InterpreterType {
    Unknown = 'Unknown',
    Conda = 'Conda',
    VirtualEnv = 'VirtualEnv',
    Pipenv = 'PipEnv',
    Pyenv = 'Pyenv',
    Venv = 'Venv',
    WindowsStore = 'WindowsStore'
}
