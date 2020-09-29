// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Uri } from 'vscode';
import { PythonEnvKind } from '../../../client/pythonEnvironments/base/info';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../../client/pythonEnvironments/base/watcher';
import { DisableableEnvsWatcher, PythonEnvsWatchers } from '../../../client/pythonEnvironments/base/watchers';

suite('Python envs watchers - PythonEnvsWatchers', () => {
    suite('onChanged consolidates', () => {
        test('empty', () => {
            const watcher = new PythonEnvsWatchers([]);

            assert.ok(watcher);
        });

        test('one', () => {
            const event1: PythonEnvsChangedEvent = {};
            const expected = [event1];
            const sub1 = new PythonEnvsWatcher();
            const watcher = new PythonEnvsWatchers([sub1]);

            const events: PythonEnvsChangedEvent[] = [];
            watcher.onChanged((e) => events.push(e));
            sub1.fire(event1);

            assert.deepEqual(events, expected);
        });

        test('many', () => {
            const loc1 = Uri.file('some-dir');
            const event1: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown, searchLocation: loc1 };
            const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Venv };
            const event3: PythonEnvsChangedEvent = {};
            const event4: PythonEnvsChangedEvent = { searchLocation: loc1 };
            const event5: PythonEnvsChangedEvent = {};
            const expected = [event1, event2, event3, event4, event5];
            const sub1 = new PythonEnvsWatcher();
            const sub2 = new PythonEnvsWatcher();
            const sub3 = new PythonEnvsWatcher();
            const watcher = new PythonEnvsWatchers([sub1, sub2, sub3]);

            const events: PythonEnvsChangedEvent[] = [];
            watcher.onChanged((e) => events.push(e));
            sub2.fire(event1);
            sub3.fire(event2);
            sub1.fire(event3);
            sub2.fire(event4);
            sub1.fire(event5);

            assert.deepEqual(events, expected);
        });
    });
});

suite('Python envs watchers - DisableableEnvsWatcher', () => {
    test('enabled by default', () => {
        const event1: PythonEnvsChangedEvent = {};
        const expected = [event1];
        const sub = new PythonEnvsWatcher();
        const watcher = new DisableableEnvsWatcher(sub);
        const events: PythonEnvsChangedEvent[] = [];
        watcher.onChanged((e) => events.push(e));

        sub.fire(event1);

        assert.deepEqual(events, expected);
    });

    suite('onChanged', () => {
        test('fires if enabled', () => {
            const event1: PythonEnvsChangedEvent = {};
            const event2: PythonEnvsChangedEvent = {};
            const expected = [event1, event2];
            const sub = new PythonEnvsWatcher();
            const watcher = new DisableableEnvsWatcher(sub);
            const events: PythonEnvsChangedEvent[] = [];
            watcher.onChanged((e) => events.push(e));

            watcher.enable();
            sub.fire(event1);
            sub.fire(event2);

            assert.deepEqual(events, expected);
        });

        test('does not fire if disabled', () => {
            const event1: PythonEnvsChangedEvent = {};
            const event2: PythonEnvsChangedEvent = {};
            const expected: PythonEnvsChangedEvent[] = [];
            const sub = new PythonEnvsWatcher();
            const watcher = new DisableableEnvsWatcher(sub);
            const events: PythonEnvsChangedEvent[] = [];
            watcher.onChanged((e) => events.push(e));

            watcher.disable();
            sub.fire(event1);
            sub.fire(event2);

            assert.deepEqual(events, expected);
        });

        test('follows enabled state', () => {
            const event1: PythonEnvsChangedEvent = {};
            const event2: PythonEnvsChangedEvent = { kind: PythonEnvKind.Unknown };
            const event3: PythonEnvsChangedEvent = { kind: PythonEnvKind.Venv };
            const expected = [event1, event3];
            const sub = new PythonEnvsWatcher();
            const watcher = new DisableableEnvsWatcher(sub);
            const events: PythonEnvsChangedEvent[] = [];
            watcher.onChanged((e) => events.push(e));

            watcher.enable();
            sub.fire(event1);
            watcher.disable();
            sub.fire(event2);
            watcher.enable();
            sub.fire(event3);

            assert.deepEqual(events, expected);
        });
    });
});
