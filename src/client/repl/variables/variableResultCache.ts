import { VariablesResult } from 'vscode';

export class VariableResultCacheBase<T> {
    private cache = new Map<string, T>();

    private executionCount = 0;

    getResults(executionCount: number, cacheKey: string): T | undefined {
        if (this.executionCount !== executionCount) {
            this.cache.clear();
            this.executionCount = executionCount;
        }

        return this.cache.get(cacheKey);
    }

    setResults(executionCount: number, cacheKey: string, results: T): void {
        if (this.executionCount < executionCount) {
            this.cache.clear();
            this.executionCount = executionCount;
        } else if (this.executionCount > executionCount) {
            // old results, don't cache
            return;
        }

        this.cache.set(cacheKey, results);
    }
}

export const VariableResultCache = VariableResultCacheBase<VariablesResult[]>;
