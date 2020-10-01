// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvInfo } from './info';
import { IPythonEnvsFinder } from './finder';

/**
 * A wrapper around a set of finders, exposing them as a single finder.
 *
 * All results are combined.
 */
export class Finders implements IPythonEnvsFinder {
    constructor(
        private readonly finders: ReadonlyArray<IFinder>,
        private readonly sortByPriority?: (envs: PythonEnvInfo[]) => PythonEnvInfo[],
    ) {}

    public async findEnv(env: string | Partial<PythonEnvInfo>): Promise<PythonEnvInfo[]> {
        const promises = this.finders.map((r) => r.findEnv(env));
        return (await Promise.all(promises))
            .reduce((p, c) => [...p, ...c]);
    }

    public async resolveEnv(env: PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (this.sortByPriority === undefined) {
            // Using Promise.race() here isn't great and Promise.all()
            // here is wasteful.
            for (const finder of this.finders) {
                const resolved = await finder.resolveEnv(env);
                if (resolved !== undefined) {
                    return resolved;
                }
            }
            return undefined;
        } else {
            const promises = this.finders.map((r) => r.resolveEnv(env));
            const results = (await Promise.all(promises))
                .filter((e) => e !== undefined);
            if (results.length === 0) {
                return undefined;
            }
            // The first one is our "best" option.
            return this.sortByPriority(results)[0];
        }
    }
}

/**
 * A finder wrapper that can be disabled.
 *
 * If disabled, nothing ever gets resolved.
 */
export class DisableableFinder implements IPythonEnvsFinder {
    protected enabled = true;

    constructor(
        // To wrap more than one use `PythonEnvFinders`.
        private readonly wrapped: IPythonEnvsFinder
    ) {}

    /**
     * Ensure that the finder is enabled.
     */
    public enable() {
        this.enabled = true;
    }

    /**
     * Ensure that the finder is disabled.
     */
    public disable() {
        this.enabled = false;
    }

    public async findEnv(env: string | Partial<PythonEnvInfo>): Promise<PythonEnvInfo[]> {
        if (!this.enabled) {
            return [];
        }
        return this.wrapped.findEnv(env);
    }

    public async resolveEnv(env: PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (!this.enabled) {
            return undefined;
        }
        return this.wrapped.resolvEnv(env);
    }
}
