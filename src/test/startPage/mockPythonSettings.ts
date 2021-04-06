// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonSettings } from '../../client/common/configSettings';

export class MockPythonSettings extends PythonSettings {
    public fireChangeEvent(): void {
        this.changed.fire();
    }

    // eslint-disable-next-line class-methods-use-this
    protected getPythonExecutable(v: string): string {
        // Don't validate python paths during tests. On windows this can take 4 or 5 seconds
        // and slow down every test
        return v;
    }
}
