import { IDataflowAnalyzer } from '../../types';
import { ILocation, IModule } from '../parse/python/python-parser';
import { ControlFlowGraph } from './controlFlow';
import { DataflowAnalyzer } from './dataFlow';
import { Set } from './set';

export enum DataflowDirection {
    Forward,
    Backward
}

export class LocationSet extends Set<ILocation> {
    constructor(...items: ILocation[]) {
        super(l => [l.first_line, l.first_column, l.last_line, l.last_column].toString(), ...items);
    }
}

function within(inner: ILocation, outer: ILocation): boolean {
    const leftWithin = outer.first_line < inner.first_line || (outer.first_line == inner.first_line && outer.first_column <= inner.first_column);
    const rightWithin = outer.last_line > inner.last_line || (outer.last_line == inner.last_line && outer.last_column >= inner.last_column);
    return leftWithin && rightWithin;
}

function isPositionBetween(line: number, column: number, start_line: number, start_column: number, end_line: number, end_column: number) {
    const afterStart = line > start_line || (line == start_line && column >= start_column);
    const beforeEnd = line < end_line || (line == end_line && column <= end_column);
    return afterStart && beforeEnd;
}

function intersect(l1: ILocation, l2: ILocation): boolean {
    return (
        isPositionBetween(l1.first_line, l1.first_column, l2.first_line, l2.first_column, l2.last_line, l2.last_column) ||
        isPositionBetween(l1.last_line, l1.last_column, l2.first_line, l2.first_column, l2.last_line, l2.last_column) ||
        within(l1, l2) ||
        within(l2, l1)
    );
}

/**
 * More general slice: given locations of important syntax nodes, find locations of all relevant
 * definitions. Locations can be mapped to lines later.
 * seedLocations are symbol locations.
 */
export function slice(ast: IModule, seedLocations: LocationSet, dataflowAnalyzer?: IDataflowAnalyzer): LocationSet {
    dataflowAnalyzer = dataflowAnalyzer || new DataflowAnalyzer();
    const cfg = new ControlFlowGraph(ast);
    const dfa = dataflowAnalyzer.analyze(cfg).flows;
    dfa.add(...cfg.getControlDependencies());

    // Include at least the full statements for each seed.
    const seedStatementLocations = new LocationSet();
    seedLocations.items.forEach(seedLoc => {
        for (const block of cfg.blocks) {
            for (const statement of block.statements) {
                if (intersect(seedLoc, statement.location)) {
                    seedStatementLocations.add(statement.location);
                }
            }
        }
    });

    const sliceLocations = new LocationSet(...seedStatementLocations.items);
    let lastSize: number;
    do {
        lastSize = sliceLocations.size;
        for (const flow of dfa.items) {
            const from = flow.fromNode.location;
            const to = flow.toNode.location;
            if (
                seedStatementLocations.items.some(seedStmtLoc => {
                    return intersect(seedStmtLoc, to);
                })
            ) {
                sliceLocations.add(to);
            }
            if (
                sliceLocations.items.some(loc => {
                    return within(to, loc);
                })
            ) {
                sliceLocations.add(from);
            }
        }
    } while (sliceLocations.size > lastSize);

    return sliceLocations;
}
