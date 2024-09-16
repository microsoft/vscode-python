/* eslint-disable max-classes-per-file */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The kind of executions that {@link TestRunProfile TestRunProfiles} control.
 */
export enum TestRunProfileKind {
    /**
     * The `Run` test profile kind.
     */
    Run = 1,
    /**
     * The `Debug` test profile kind.
     */
    Debug = 2,
    /**
     * The `Coverage` test profile kind.
     */
    Coverage = 3,
}
