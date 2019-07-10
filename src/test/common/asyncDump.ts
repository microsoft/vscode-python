'use strict';

// Got this from here:
// https://gist.github.com/boneskull/7fe75b63d613fa940db7ec990a5f5843
// from a discussion about debugging mocha hangs.

//tslint:disable:no-require-imports no-var-requires no-any

const { createHook } = require('async_hooks');
const { stackTraceFilter } = require('mocha/lib/utils');
const allResources = new Map();

// this will pull Mocha internals out of the stacks
const filterStack = stackTraceFilter();

const hook = createHook({
    init(asyncId: any, type: any, triggerAsyncId: any) {
        allResources.set(asyncId, { type, triggerAsyncId, stack: (new Error()).stack });
    },
    destroy(asyncId: any) {
        allResources.delete(asyncId);
    }
}).enable();

// Call this function to debug async hangs. It should print out stack traces of still running promises.
export function asyncDump() {
    hook.disable();
    // tslint:disable-next-line: no-multiline-string
    console.error(`
  STUFF STILL IN THE EVENT LOOP:`);
    allResources.forEach(value => {
        console.error(`Type: ${value.type}`);
        console.error(filterStack(value.stack));
        console.error('\n');
    });
}
