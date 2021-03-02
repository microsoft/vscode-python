// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const pidusageTree = require('pidusage-tree');

/**
 * Calculates number of bytes of memory consumed by the entire process tree with
 * `pid` as the root process.
 * @param pid : Process ID to compute memory usage.
 * @returns : Memory consumed in bytes.
 */
export async function getMemoryUsage(pid: number): Promise<number> {
    const result = await pidusageTree(pid);
    let memory = 0;
    if (result) {
        for (const key of Object.keys(result)) {
            memory += result[key]?.memory ?? 0;
        }
    }
    return memory;
}
