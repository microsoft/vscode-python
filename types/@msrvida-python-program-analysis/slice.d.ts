import { Location, Module } from './python-parser';
import { DataflowAnalyzer } from './data-flow';
import { NumberSet, Set } from './set';
export declare class LocationSet extends Set<Location> {
    constructor(...items: Location[]);
}
export declare enum SliceDirection {
    Forward = 0,
    Backward = 1
}
/**
 * More general slice: given locations of important syntax nodes, find locations of all relevant
 * definitions. Locations can be mapped to lines later.
 * seedLocations are symbol locations.
 */
export declare function slice(ast: Module, seedLocations?: LocationSet, dataflowAnalyzer?: DataflowAnalyzer, direction?: SliceDirection): LocationSet;
/**
 * Slice: given a set of lines in a program, return lines it depends on.
 * OUT OF DATE: use slice() instead of sliceLines().
 */
export declare function sliceLines(code: string, relevantLineNumbers: NumberSet): NumberSet;
