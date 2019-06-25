import { inject, injectable } from 'inversify';
import { isNil } from 'lodash';
import { IDataflowAnalyzer, IProgramBuilder } from '../../types';
import { IGatherCell } from '../model/cell';
import * as ast from '../parse/python/python-parser';
import { IRef } from './dataFlow';
import { MagicsRewriter } from './rewriteMagics';
import { NumberSet } from './set';

/**
 * Maps to find out what line numbers over a program correspond to what cells.
 */
export type CellToLineMap = { [cellExecutionEventId: string]: NumberSet };
export type LineToCellMap = { [line: number]: IGatherCell };

/**
 * A program built from cells.
 */
export class Program {
    public readonly text: string;
    public readonly tree: ast.IModule;
    public readonly cellToLineMap: CellToLineMap;
    public readonly lineToCellMap: LineToCellMap;
    /**
     * Construct a program.
     */
    constructor(text: string, tree: ast.IModule, cellToLineMap: CellToLineMap, lineToCellMap: LineToCellMap) {
        this.text = text;
        this.tree = tree;
        this.cellToLineMap = cellToLineMap;
        this.lineToCellMap = lineToCellMap;
    }
}

/**
 * Program fragment for a cell. Used to cache parsing results.
 */
export class CellProgram {
    public readonly cell: IGatherCell;
    public readonly statements: ast.ISyntaxNode[];
    public readonly defs: IRef[];
    public readonly uses: IRef[];
    public readonly hasError: boolean;
    /**
     * Construct a cell program
     */
    constructor(cell: IGatherCell, statements: ast.ISyntaxNode[], defs: IRef[], uses: IRef[], hasError: boolean) {
        this.cell = cell;
        this.statements = statements;
        this.defs = defs;
        this.uses = uses;
        this.hasError = hasError;
    }
}

/**
 * Builds programs from a list of executed cells.
 */
@injectable()
export class ProgramBuilder implements IProgramBuilder {
    public cellPrograms: CellProgram[];
    private _magicsRewriter: MagicsRewriter = new MagicsRewriter();
    /**
     * Construct a program builder.
     */
    constructor(
        @inject(IDataflowAnalyzer) public dataflowAnalyzer: IDataflowAnalyzer
        ) {
        this.cellPrograms = [];
    }

    /**
     * Add cells to the program builder.
     */
    public add(...cells: IGatherCell[]) {
        for (const cell of cells) {
            // Proactively try to parse and find defs and uses in each block.
            // If there is a failure, discard that cell.
            let statements: ast.ISyntaxNode[] = [];
            let defs: IRef[];
            let uses: IRef[];
            let hasError = cell.hasError;
            try {
                // Parse the cell's code.
                const tree = ast.parse(this._magicsRewriter.rewrite(cell.text) + '\n');
                statements = tree.code;
                // Annotate each node with cell ID info, for dataflow caching.
                for (const node of ast.walk(tree)) {
                    // Sanity check that this is actually a node.
                    if (node.hasOwnProperty('type')) {
                        node.cellExecutionEventId = cell.executionEventId;
                    }
                }
                // By querying for defs and uses right when a cell is added to the log, we
                // can cache these results, making dataflow analysis faster.
                if (this.dataflowAnalyzer) {
                    defs = [];
                    uses = [];
                    for (const stmt of tree.code) {
                        const defsUses = this.dataflowAnalyzer.getDefsUses(stmt);
                        defs.push(...defsUses.defs.items);
                        uses.push(...defsUses.uses.items);
                    }
                } else {
                    defs = [];
                    uses = [];
                }
            } catch (e) {
                console.log('Couldn\'t analyze block', cell.text, ', error encountered, ', e, ', not adding to programs.');
                hasError = true;
            }
            this.cellPrograms.push(new CellProgram(cell, statements, defs, uses, hasError));
        }
    }

    /**
     * Reset (removing all cells).
     */
    public reset() {
        this.cellPrograms = [];
    }

    /**
     * Build a program from the list of cells. Program will include the cells' contents in
     * the order they were added to the log. It will omit cells that raised errors (syntax or
     * runtime, except for the last cell).
     */
    public buildTo(cellExecutionEventId: string): Program {
        let addingPrograms = false;
        let lastExecutionCountSeen;
        const cellPrograms: CellProgram[] = [];

        for (let i = this.cellPrograms.length - 1; i >= 0; i--) {
            const cellProgram = this.cellPrograms[i];
            const cell = cellProgram.cell;
            if (!addingPrograms && cell.executionEventId === cellExecutionEventId) {
                addingPrograms = true;
                lastExecutionCountSeen = cell.executionCount;
                cellPrograms.unshift(cellProgram);
                continue;
            }
            if (addingPrograms) {
                if (cell.executionCount >= lastExecutionCountSeen) {
                    break;
                }
                if (!cellProgram.hasError) {
                    cellPrograms.unshift(cellProgram);
                }
                lastExecutionCountSeen = cell.executionCount;
            }
        }

        let code = '';
        let currentLine = 1;
        const lineToCellMap: LineToCellMap = {};
        const cellToLineMap: CellToLineMap = {};

        // Synthetic parse tree built from the cell parse trees.
        const tree: ast.IModule = {
            code: [],
            type: ast.MODULE,
            location: undefined
        };

        cellPrograms.forEach(cp => {
            const cell = cp.cell;
            const cellCode = cell.text;
            const statements = [];

            // Build a mapping from the cells to their lines.
            const cellLength = cellCode.split('\n').length;
            const cellLines = [];
            for (let l = 0; l < cellLength; l++) {
                cellLines.push(currentLine + l);
            }
            cellLines.forEach(l => {
                lineToCellMap[l] = cell;
                if (!cellToLineMap[cell.executionEventId]) { cellToLineMap[cell.executionEventId] = new NumberSet(); }
                cellToLineMap[cell.executionEventId].add(l);
            });

            // Accumulate the code text.
            const cellText = this._magicsRewriter.rewrite(cell.text);
            code += cellText + '\n';
            currentLine += cellLength;

            // Accumulate the code statements.
            // This includes resetting the locations of all of the nodes in the tree,
            // relative to the cells that come before this one.
            // This can be sped up by saving this computation.
            const cellStart = Math.min(...cellLines);
            for (const statement of cp.statements) {
                const statementCopy = JSON.parse(JSON.stringify(statement));
                for (const node of ast.walk(statementCopy)) {
                    if (node.location) {
                        node.location.first_line += cellStart - 1;
                        node.location.last_line += cellStart - 1;
                    }
                    if (node.type == ast.FOR) {
                        node.decl_location.first_line += cellStart - 1;
                        node.decl_location.last_line += cellStart - 1;
                    }
                }
                statements.push(statementCopy);
            }
            tree.code.push(...statements);
        });

        return new Program(code, tree, cellToLineMap, lineToCellMap);
    }

    public getCellProgram(cell: IGatherCell): CellProgram {
        const matchingPrograms = this.cellPrograms.filter(cp => cp.cell.executionEventId == cell.executionEventId);
        if (matchingPrograms.length >= 1 && !isNil(matchingPrograms)) {
            return matchingPrograms.pop();
        }
        return null;
    }
}
