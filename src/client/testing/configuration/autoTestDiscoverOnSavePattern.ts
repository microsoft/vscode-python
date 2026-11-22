// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as minimatch from 'minimatch';
import { AutoTestDiscoverOnSavePattern } from './types';

/**
 * Default pattern registered for `python.testing.autoTestDiscoverOnSavePattern`.
 * Kept in sync with the `default` in package.json.
 */
export const DEFAULT_AUTO_TEST_DISCOVER_ON_SAVE_PATTERN: Readonly<Record<string, boolean>> = {
    '**/*.py': true,
};

/**
 * Resolve `${...}` variables in glob keys.
 *
 * `SystemVariables.resolveAny` walks object values and leaves keys untouched.
 * Patterns live in the keys, the same way `files.exclude` does, so callers
 * pass the string resolver and we rebuild the map.
 * A legacy string pattern is returned unchanged; the caller has already
 * resolved that string.
 */
export function resolveAutoTestDiscoverOnSavePattern(
    pattern: AutoTestDiscoverOnSavePattern | undefined,
    resolveString: (value: string) => string,
): AutoTestDiscoverOnSavePattern | undefined {
    if (typeof pattern === 'string' || !isPatternMap(pattern)) {
        return pattern;
    }

    const resolved: Record<string, boolean> = {};
    Object.entries(pattern).forEach(([key, value]) => {
        if (typeof value !== 'boolean') {
            return;
        }
        const resolvedKey = resolveString(key).trim();
        if (!resolvedKey) {
            return;
        }
        // A later entry wins when two keys resolve to the same glob, which
        // matches the last-write behavior of a settings object.
        resolved[resolvedKey] = value;
    });
    return resolved;
}

/**
 * A saved file triggers discovery when it matches any pattern whose value is `true`.
 *
 * VS Code deep-merges this object across default, user, workspace, and folder
 * scopes before the extension reads it. A `false` value turns that one pattern
 * off so a narrower scope can disable a pattern inherited from a broader scope
 * (including the default Python glob). It does not exclude a file that matches a
 * different enabled pattern. That is the same model as `files.exclude`.
 *
 * The previous setting was a single glob string matched against the absolute
 * path. Object patterns are also matched against the workspace-relative path
 * so globs written like `files.exclude` (relative to the workspace) work.
 */
export function matchesAutoTestDiscoverOnSavePattern(
    fsPath: string,
    pattern: AutoTestDiscoverOnSavePattern | undefined | null,
    workspaceRoot?: string,
): boolean {
    const globs = enabledGlobs(pattern);
    if (globs.length === 0) {
        return false;
    }
    const candidates = pathsToMatch(fsPath, workspaceRoot);
    return globs.some((glob) => {
        const normalizedGlob = toPosixPath(glob).trim();
        return (
            normalizedGlob.length > 0 && candidates.some((candidate) => minimatch.default(candidate, normalizedGlob))
        );
    });
}

function enabledGlobs(pattern: AutoTestDiscoverOnSavePattern | undefined | null): string[] {
    if (typeof pattern === 'string') {
        const glob = pattern.trim();
        return glob ? [glob] : [];
    }
    if (!isPatternMap(pattern)) {
        return [];
    }
    return Object.keys(pattern).filter((key) => pattern[key] === true && key.trim().length > 0);
}

function pathsToMatch(fsPath: string, workspaceRoot?: string): string[] {
    const absolutePath = toPosixPath(fsPath);
    const candidates = new Set<string>([absolutePath]);

    // minimatch treats `:` as an extglob character, so `C:/...` often fails to
    // match a `**` glob. Also try the path without the drive prefix.
    const withoutDrive = absolutePath.replace(/^[A-Za-z]:/, '');
    if (withoutDrive !== absolutePath) {
        candidates.add(withoutDrive);
    }

    if (workspaceRoot) {
        const relativePath = workspaceRelativePath(absolutePath, workspaceRoot);
        if (relativePath) {
            candidates.add(relativePath);
        }
    }

    return Array.from(candidates);
}

function workspaceRelativePath(fsPath: string, workspaceRoot: string): string | undefined {
    let root = toPosixPath(workspaceRoot);
    if (root.endsWith('/')) {
        root = root.slice(0, -1);
    }
    if (!root) {
        return undefined;
    }

    // Windows paths are case-insensitive. Treat a drive-letter path the same
    // way when tests run on a case-sensitive OS.
    const windows = process.platform === 'win32' || /^[A-Za-z]:\//.test(fsPath);
    const fileForCompare = windows ? fsPath.toLowerCase() : fsPath;
    const rootForCompare = windows ? root.toLowerCase() : root;
    const prefix = `${rootForCompare}/`;
    if (!fileForCompare.startsWith(prefix)) {
        return undefined;
    }
    const relativePath = fsPath.slice(prefix.length);
    return relativePath.length > 0 ? relativePath : undefined;
}

/**
 * minimatch treats `\` as an escape. Normalize separators so a Windows path
 * and a glob written with backslashes match the same way they do elsewhere.
 */
function toPosixPath(value: string): string {
    return value.replace(/\\/g, '/');
}

function isPatternMap(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
