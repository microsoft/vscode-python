// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { TextDocument, Uri } from 'vscode';
import { InteractiveInputScheme, NotebookCellScheme } from '../constants';
import { InterpreterUri } from '../installer/types';
import { Resource } from '../types';
import { isPromise } from './async';
import { StopWatch } from './stopWatch';

export function noop() {}

/**
 * Like `Readonly<>`, but recursive.
 *
 * See https://github.com/Microsoft/TypeScript/pull/21316.
 */

type DeepReadonly<T> = T extends any[] ? IDeepReadonlyArray<T[number]> : DeepReadonlyNonArray<T>;
type DeepReadonlyNonArray<T> = T extends object ? DeepReadonlyObject<T> : T;
interface IDeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}
type DeepReadonlyObject<T> = {
    readonly [P in NonFunctionPropertyNames<T>]: DeepReadonly<T[P]>;
};
type NonFunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];

// Information about a traced function/method call.
export type TraceInfo = {
    elapsed: number; // milliseconds
    // Either returnValue or err will be set.

    returnValue?: any;
    err?: Error;
};

// Call run(), call log() with the trace info, and return the result.
export function tracing<T>(log: (t: TraceInfo) => void, run: () => T): T {
    const timer = new StopWatch();
    try {
        const result = run();

        // If method being wrapped returns a promise then wait for it.
        if (isPromise(result)) {
            (result as Promise<void>)
                .then((data) => {
                    log({ elapsed: timer.elapsedTime, returnValue: data });
                    return data;
                })
                .catch((ex) => {
                    log({ elapsed: timer.elapsedTime, err: ex });

                    // TODO(GH-11645) Re-throw the error like we do
                    // in the non-Promise case.
                });
        } else {
            log({ elapsed: timer.elapsedTime, returnValue: result });
        }
        return result;
    } catch (ex) {
        log({ elapsed: timer.elapsedTime, err: ex });
        throw ex;
    }
}

/**
 * Checking whether something is a Resource (Uri/undefined).
 * Using `instanceof Uri` doesn't always work as the object is not an instance of Uri (at least not in tests).
 * That's why VSC too has a helper method `URI.isUri` (though not public).
 *
 * @export
 * @param {InterpreterUri} [resource]
 * @returns {resource is Resource}
 */
export function isResource(resource?: InterpreterUri): resource is Resource {
    if (!resource) {
        return true;
    }
    const uri = resource as Uri;
    return typeof uri.path === 'string' && typeof uri.scheme === 'string';
}

/**
 * Checking whether something is a Uri.
 * Using `instanceof Uri` doesn't always work as the object is not an instance of Uri (at least not in tests).
 * That's why VSC too has a helper method `URI.isUri` (though not public).
 *
 * @param {InterpreterUri} [resource]
 * @returns {resource is Uri}
 */

function isUri(resource?: Uri | any): resource is Uri {
    if (!resource) {
        return false;
    }
    const uri = resource as Uri;
    return typeof uri.path === 'string' && typeof uri.scheme === 'string';
}

/**
 * Create a filter func that determine if the given URI and candidate match.
 *
 * The scheme must match, as well as path.
 *
 * @param checkParent - if `true`, match if the candidate is rooted under `uri`
 * @param checkChild - if `true`, match if `uri` is rooted under the candidate
 * @param checkExact - if `true`, match if the candidate matches `uri` exactly
 */
export function getURIFilter(
    uri: Uri,
    opts: {
        checkParent?: boolean;
        checkChild?: boolean;
        checkExact?: boolean;
    } = { checkExact: true },
): (u: Uri) => boolean {
    let uriPath = uri.path;
    while (uri.path.endsWith('/')) {
        uriPath = uriPath.slice(0, -1);
    }
    const uriRoot = `${uriPath}/`;
    function filter(candidate: Uri): boolean {
        if (candidate.scheme !== uri.scheme) {
            return false;
        }
        let candidatePath = candidate.path;
        while (candidate.path.endsWith('/')) {
            candidatePath = candidatePath.slice(0, -1);
        }
        if (opts.checkExact && candidatePath === uriPath) {
            return true;
        }
        if (opts.checkParent && candidatePath.startsWith(uriRoot)) {
            return true;
        }
        if (opts.checkChild) {
            const candidateRoot = `{candidatePath}/`;
            if (uriPath.startsWith(candidateRoot)) {
                return true;
            }
        }
        return false;
    }
    return filter;
}

export function isNotebookCell(documentOrUri: TextDocument | Uri): boolean {
    const uri = isUri(documentOrUri) ? documentOrUri : documentOrUri.uri;
    return uri.scheme.includes(NotebookCellScheme) || uri.scheme.includes(InteractiveInputScheme);
}
