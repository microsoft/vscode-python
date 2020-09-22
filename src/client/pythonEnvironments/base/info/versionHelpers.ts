// Copyright (c) Microsoft Corporation. All rights reserved.

import { PythonVersion } from '.';

// Licensed under the MIT License.
export function areSameVersion(left: PythonVersion, right:PythonVersion): boolean {
    return (
        left.major === right.major
        && left.minor === right.minor
        && left.micro === right.micro
        && left.release.level === right.release.level
    );
}
