'use strict';

//tslint:disable:no-require-imports no-var-requires
const log = require('why-is-node-running');

// Call this function to debug async hangs. It should print out stack traces of still running promises.
export function asyncDump() {
    log();
}
