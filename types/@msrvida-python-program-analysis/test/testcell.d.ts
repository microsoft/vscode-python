import { Cell } from "..";
export declare class TestCell implements Cell {
    text: string;
    executionCount: number;
    hasError: boolean;
    executionEventId: string;
    persistentId: string;
    constructor(text: string, executionCount: number, executionEventId?: string, persistentId?: string, hasError?: boolean);
    deepCopy(): this;
}
