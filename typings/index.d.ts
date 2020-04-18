// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.


// Added to allow compilation of backbone types pulled in from ipywidgets (@jupyterlab/widgets).
declare module JQuery {
    type TriggeredEvent = any;
}

declare module '@phosphor/coreutils' {
    export class PromiseDelegate<T> {
        /**
         * The promise wrapped by the delegate.
         */
        public readonly promise: Promise<T>;
        /**
         * Construct a new promise delegate.
         */
        constructor();
        /**
         * Reject the wrapped promise with the given value.
         *
         * @reason - The reason for rejecting the promise.
         */
        reject(reason: any): void;
        /**
         * Resolve the wrapped promise with the given value.
         *
         * @param value - The value to use for resolving the promise.
         */
        resolve(value: T | PromiseLike<T>): void;
    }
    /**
     * A type definition for the MimeData class.
     * Based on http://phosphorjs.github.io/phosphor/api/coreutils/classes/mimedata.html
     */
    export class MimeData {
        private _types: string[];
        private _values: any[];
        public clear(): void;
        public clearData(mime: string): void;
        public getData(mime: string): any | undefined;
        public hasData(mime: string): boolean;
        public setData(mime: string, data: any): void;
        public types(): string[];
    }
    /**
     * The namespace for UUID related functionality.
     */
    export namespace UUID {
        /**
         * A function which generates UUID v4 identifiers.
         * @returns A new UUID v4 string.
         */
        const uuid4: () => string;
    }
    /**
     * A type alias for a JSON primitive.
     */
    export type JSONPrimitive = boolean | number | string | null | undefined;
    /**
     * A type alias for a JSON value.
     */
    export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
    /**
     * A type definition for a JSON object.
     */
    export interface JSONObject {
        [key: string]: JSONValue;
    }
    /**
     * A type definition for a JSON array.
     */
    export interface JSONArray extends Array<JSONValue> { }
    /**
     * A type definition for a readonly JSON object.
     */
    export interface ReadonlyJSONObject {
        readonly [key: string]: ReadonlyJSONValue;
    }
    /**
     * A type definition for a readonly JSON array.
     */
    export interface ReadonlyJSONArray extends ReadonlyArray<ReadonlyJSONValue> { }
    /**
     * A type alias for a readonly JSON value.
     */
    export type ReadonlyJSONValue = JSONPrimitive | ReadonlyJSONObject | ReadonlyJSONArray;
    /**
     * The namespace for JSON-specific functions.
     */
    export namespace JSONExt {
        /**
         * A shared frozen empty JSONObject
         */
        const emptyObject: ReadonlyJSONObject;
        /**
         * A shared frozen empty JSONArray
         */
        const emptyArray: ReadonlyJSONArray;
        /**
         * Test whether a JSON value is a primitive.
         *
         * @param value - The JSON value of interest.
         *
         * @returns `true` if the value is a primitive,`false` otherwise.
         */
        function isPrimitive(value: ReadonlyJSONValue): value is JSONPrimitive;
        /**
         * Test whether a JSON value is an array.
         *
         * @param value - The JSON value of interest.
         *
         * @returns `true` if the value is a an array, `false` otherwise.
         */
        function isArray(value: JSONValue): value is JSONArray;
        function isArray(value: ReadonlyJSONValue): value is ReadonlyJSONArray;
        /**
         * Test whether a JSON value is an object.
         *
         * @param value - The JSON value of interest.
         *
         * @returns `true` if the value is a an object, `false` otherwise.
         */
        function isObject(value: JSONValue): value is JSONObject;
        function isObject(value: ReadonlyJSONValue): value is ReadonlyJSONObject;
        /**
         * Compare two JSON values for deep equality.
         *
         * @param first - The first JSON value of interest.
         *
         * @param second - The second JSON value of interest.
         *
         * @returns `true` if the values are equivalent, `false` otherwise.
         */
        function deepEqual(first: ReadonlyJSONValue, second: ReadonlyJSONValue): boolean;
        /**
         * Create a deep copy of a JSON value.
         *
         * @param value - The JSON value to copy.
         *
         * @returns A deep copy of the given JSON value.
         */
        function deepCopy<T extends ReadonlyJSONValue>(value: T): T;
    }

    export class Token<T> {
        /**
         * The human readable name for the token.
         *
         * #### Notes
         * This can be useful for debugging and logging.
         */
        public readonly name: string;
        private _tokenStructuralPropertyT;
        /**
         * Construct a new token.
         *
         * @param name - A human readable name for the token.
         */
        constructor(name: string);
    }
}
