/**
 * Configuration to help a conservative program slicer know what to ignore.
 * Default rules are listed in {@code schema/plugin.json}.
 */
export type SliceConfiguration = {
    objectName?: string;
    functionName: string;
    doesNotModify: (string | Number)[];
}[];
