import { IDataflowAnalyzer, IDefUseInfo, ISymbolTable } from '../../types';
import * as ast from '../parse/python/python-parser';
import { Block, ControlFlowGraph } from './controlFlow';
import { Set, StringSet } from './set';
import { SliceConfiguration } from './sliceConfig';

export interface IDataflow {
    fromNode: ast.ISyntaxNode;
    toNode: ast.ISyntaxNode;
}

export enum ReferenceType {
    DEFINITION = 'DEFINITION',
    UPDATE = 'UPDATE',
    USE = 'USE'
}

export enum SymbolType {
    VARIABLE,
    CLASS,
    FUNCTION,
    IMPORT,
    MUTATION,
    MAGIC
}

export interface IRef {
    type: SymbolType;
    level: ReferenceType;
    name: string;
    location: ast.ILocation;
    statement: ast.ISyntaxNode;
}


const DEPENDENCY_RULES = [
    // "from" depends on all reference types in "to"
    {
        from: ReferenceType.USE,
        to: [ReferenceType.UPDATE, ReferenceType.DEFINITION]
    },
    {
        from: ReferenceType.UPDATE,
        to: [ReferenceType.DEFINITION]
    }
];

const TYPES_WITH_DEPENDENCIES = DEPENDENCY_RULES.map(r => r.from);

const KILL_RULES = [
    // Which types of references "kill" which other types of references?
    // In general, the rule of thumb here is, if x depends on y, x kills y, because anything that
    // depends on x will now depend on y transitively.
    // If x overwrites y, x also kills y.
    // The one case where a variable doesn't kill a previous variable is the global configuration, because
    // it neither depends on initializations or updates, nor clobbers them.
    {
        level: ReferenceType.DEFINITION,
        kills: [ReferenceType.DEFINITION, ReferenceType.UPDATE]
    },
    {
        level: ReferenceType.UPDATE,
        kills: [ReferenceType.DEFINITION, ReferenceType.UPDATE]
    }
];

export class RefSet extends Set<IRef> {
    constructor(...items: IRef[]) {
        super(r => r.name + r.level + r.location.toString(), ...items);
    }
}

/**
 * Tree walk listener for collecting manual def annotations.
 */
class DefAnnotationListener implements ast.IWalkListener {
    public readonly defs: RefSet = new RefSet();

    private _statement: ast.ISyntaxNode;
    constructor(statement: ast.ISyntaxNode) {
        this._statement = statement;
    }

    public onEnterNode(node: ast.ISyntaxNode, type: string) {
        if (type == ast.LITERAL) {
            const literal = node as ast.ILiteral;

            // If this is a string, try to parse a def annotation from it
            if (typeof literal.value == 'string' || literal.value instanceof String) {
                const string = literal.value;
                const jsonMatch = string.match(/"defs: (.*)"/);
                if (jsonMatch && jsonMatch.length >= 2) {
                    const jsonString = jsonMatch[1];
                    const jsonStringUnescaped = jsonString.replace(/\\"/g, '"');
                    try {
                        const defSpecs = JSON.parse(jsonStringUnescaped);
                        for (const defSpec of defSpecs) {
                            this.defs.add({
                                type: SymbolType.MAGIC,
                                level: ReferenceType.DEFINITION,
                                name: defSpec.name,
                                location: {
                                    first_line: defSpec.pos[0][0] + node.location.first_line,
                                    first_column: defSpec.pos[0][1],
                                    last_line: defSpec.pos[1][0] + node.location.first_line,
                                    last_column: defSpec.pos[1][1]
                                },
                                statement: this._statement
                            });
                        }
                    } catch (e) {}
                }
            }
        }
    }
}

/**
 * Tree walk listener for collecting names used in function call.
 */
class CallNamesListener implements ast.IWalkListener {
    public readonly defs: RefSet = new RefSet();

    private _sliceConfiguration: SliceConfiguration;
    private _statement: ast.ISyntaxNode;
    private _subtreesToProcess: ast.ISyntaxNode[] = [];
    constructor(sliceConfiguration: SliceConfiguration, statement: ast.ISyntaxNode) {
        this._sliceConfiguration = sliceConfiguration;
        this._statement = statement;
    }

// tslint:disable-next-line: cyclomatic-complexity
    public onEnterNode(node: ast.ISyntaxNode, type: string, ancestors: ast.ISyntaxNode[]) {
        if (type == ast.CALL) {
            const callNode = node as ast.ICall;
            let functionNameNode: ast.ISyntaxNode;
            let functionName: string;
            if (callNode.func.type == ast.DOT) {
                functionNameNode = callNode.func.name;
                functionName = functionNameNode.toString();
            } else {
                functionNameNode = callNode.func as ast.IName;
                functionName = functionNameNode.id;
            }

            const skipRules = this._sliceConfiguration
                .filter(config => config.functionName == functionName)
                .filter(config => {
                    if (!config.objectName) { return true; }
                    if (callNode.func.type == ast.DOT && callNode.func.value.type == ast.NAME) {
                        const instanceName = (callNode.func.value as ast.IName).id;
                        return config.objectName == instanceName;
                    }
                    return false;
                });

            if (callNode.func.type == ast.DOT) {
                let skipObject = false;
                for (const skipRule of skipRules) {
                    if (skipRule.doesNotModify.indexOf('OBJECT') !== -1) {
                        skipObject = true;
                        break;
                    }
                }
                if (!skipObject && callNode.func.value !== undefined) {
                    this._subtreesToProcess.push(callNode.func.value);
                }
            }

            for (let i = 0; i < callNode.args.length; i++) {
                const arg = callNode.args[i];
                let skipArg = false;
                for (const skipRule of skipRules) {
                    for (const skipSpec of skipRule.doesNotModify) {
                        if (typeof skipSpec === 'number' && skipSpec === i) {
                            skipArg = true;
                            break;
                        } else if (typeof skipSpec === 'string') {
                            if (skipSpec === 'ARGUMENTS' || (arg.keyword && (arg.keyword as ast.IName).id === skipSpec)) {
                                skipArg = true;
                                break;
                            }
                        }
                    }
                    if (skipArg) { break; }
                }
                if (!skipArg) {
                    this._subtreesToProcess.push(arg.actual);
                }
            }
        }

        if (type == ast.NAME) {
            for (const ancestor of ancestors) {
                if (this._subtreesToProcess.indexOf(ancestor) !== -1) {
                    this.defs.add({
                        type: SymbolType.MUTATION,
                        level: ReferenceType.UPDATE,
                        name: (node as ast.IName).id,
                        location: node.location,
                        statement: this._statement
                    });
                    break;
                }
            }
        }
    }
}

// tslint:disable-next-line: max-classes-per-file
class NameSet extends Set<[string, ast.ISyntaxNode]> {
    constructor(...items: [string, ast.ISyntaxNode][]) {
        super(getNameSetId, ...items);
    }
}

/**
 * Tree walk listener for collecting definitions in the target of an assignment.
 */
// tslint:disable-next-line: max-classes-per-file
class TargetsDefListener implements ast.IWalkListener {
    public readonly defs: RefSet = new RefSet();

    private _statement: ast.ISyntaxNode;
    constructor(statement: ast.ISyntaxNode) {
        this._statement = statement;
    }

    public onEnterNode(node: ast.ISyntaxNode, type: string, ancestors: ast.ISyntaxNode[]) {
        if (type == ast.NAME) {
            let level = ReferenceType.DEFINITION;
            if (ancestors.some(a => a.type == ast.DOT)) {
                level = ReferenceType.UPDATE;
            } else if (ancestors.some(a => a.type == ast.INDEX)) {
                level = ReferenceType.UPDATE;
            }
            this.defs.add({
                type: SymbolType.VARIABLE,
                level: level,
                location: node.location,
                name: (node as ast.IName).id,
                statement: this._statement
            });
        }
    }
}

function updateDefsForLevel(defsForLevel: RefSet, level: string, newRefs: { [level: string]: RefSet }, dependencyRules: { from: ReferenceType; to: ReferenceType[] }[]) {
    const genSet = new RefSet();
    const levelDependencies = dependencyRules.filter(r => r.from == level).pop();
    for (const level of Object.keys(ReferenceType)) {
        newRefs[level].items.forEach(ref => {
            if (levelDependencies && levelDependencies.to.indexOf(ref.level) != -1) {
                genSet.add(ref);
            }
        });
    }
    const killSet = defsForLevel.filter(def => {
        let found = false;
        genSet.items.forEach(gen => {
            if (gen.name == def.name) {
                const killRules = KILL_RULES.filter(r => r.level == gen.level).pop();
                if (killRules && killRules.kills.indexOf(def.level) != -1) {
                    found = true;
                }
            }
        });
        return found;
    });
    return defsForLevel.minus(killSet).union(genSet);
}

/**
 * Use a shared dataflow analyzer object for all dataflow analysis / querying for defs and uses.
 * It caches defs and uses for each statement, which can save time.
 * For caching to work, statements must be annotated with a cell's ID and execution count.
 */
// tslint:disable-next-line: max-classes-per-file
export class DataflowAnalyzer implements IDataflowAnalyzer {
    private _sliceConfiguration: SliceConfiguration;
    private _defUsesCache: { [statementLocation: string]: IDefUseInfo } = {};

    constructor(sliceConfiguration?: SliceConfiguration) {
        this._sliceConfiguration = sliceConfiguration || [];
    }

    public getDefsUses(statement: ast.ISyntaxNode, symbolTable?: ISymbolTable): IDefUseInfo {
        symbolTable = symbolTable || { moduleNames: new StringSet() };
        const cacheKey = this._statementLocationKey(statement);
        if (cacheKey != null) {
            if (this._defUsesCache.hasOwnProperty(cacheKey)) {
                return this._defUsesCache[cacheKey];
            }
        }
        const defSet = this.getDefs(statement, symbolTable);
        const useSet = this.getUses(statement, symbolTable);
        const result = { defs: defSet, uses: useSet };
        if (cacheKey != null) {
            this._defUsesCache[cacheKey] = result;
        }
        return result;
    }

    // tslint:disable-next-line: cyclomatic-complexity
    public analyze(cfg: ControlFlowGraph, sliceConfiguration?: SliceConfiguration, namesDefined?: StringSet): DataflowAnalysisResult {
        // tslint:disable-next-line: max-func-body-length
        sliceConfiguration = sliceConfiguration || [];
        const symbolTable: ISymbolTable = { moduleNames: new StringSet() };
        const workQueue: Block[] = cfg.blocks.reverse();
        const undefinedRefs = new RefSet();

        const defsForLevelByBlock: {
            [level: string]: { [blockId: number]: RefSet };
        } = {};
        for (const level of Object.keys(ReferenceType)) {
            defsForLevelByBlock[level] = {};
            for (const block of workQueue) {
                defsForLevelByBlock[level][block.id] = new RefSet();
            }
        }

        let dataflows = new Set<IDataflow>(getDataflowId);

        while (workQueue.length) {
            const block = workQueue.pop();

            const oldDefsForLevel: { [level: string]: RefSet } = {};
            const defsForLevel: { [level: string]: RefSet } = {};
            for (const level of Object.keys(ReferenceType)) {
                oldDefsForLevel[level] = defsForLevelByBlock[level][block.id];
                // incoming definitions are come from predecessor blocks
                defsForLevel[level] = oldDefsForLevel[level].union(
                    ...cfg
                        .getPredecessors(block)
                        .map(block => defsForLevelByBlock[level][block.id])
                        .filter(s => s != undefined)
                );
            }

            // TODO: fix up dataflow computation within this block: check for definitions in
            // defsWithinBlock first; if found, don't look to defs that come from the predecessor.
            for (const statement of block.statements) {
                // Note that defs includes both definitions and mutations and variables
                const { defs: definedHere, uses: usedHere } = this.getDefsUses(statement, symbolTable);

                // Sort definitions and uses into references.
                const statementRefs: { [level: string]: RefSet } = {};
                for (const level of Object.keys(ReferenceType)) {
                    statementRefs[level] = new RefSet();
                }
                for (const def of definedHere.items) {
                    statementRefs[def.level].add(def);
                    if (TYPES_WITH_DEPENDENCIES.indexOf(def.level) != -1) {
                        undefinedRefs.add(def);
                    }
                }
                // Only add uses that aren't actually defs.
                for (const use of usedHere.items) {
                    if (!definedHere.items.some(def => def.level == ReferenceType.DEFINITION && def.name == use.name && sameLocation(def.location, use.location))) {
                        statementRefs[ReferenceType.USE].add(use);
                        undefinedRefs.add(use);
                    }
                }

                // Get all new dataflow dependencies.
                const newFlows = new Set<IDataflow>(getDataflowId);
                for (const level of Object.keys(ReferenceType)) {
                    // For everything that's defined coming into this block, if it's used in this block, save connection.
                    const result = createFlowsFrom(statementRefs[level], defsForLevel[level], statement);
                    const flowsCreated = result[0].items;
                    const defined = result[1];
                    newFlows.add(...flowsCreated);
                    for (const ref of defined.items) {
                        undefinedRefs.remove(ref);
                    }
                }
                dataflows = dataflows.union(newFlows);

                for (const level of Object.keys(ReferenceType)) {
                    // 🙄 it doesn't really make sense to update the "use" set for a block but whatever
                    defsForLevel[level] = updateDefsForLevel(defsForLevel[level], level, statementRefs, DEPENDENCY_RULES);
                }
            }

            // Check to see if definitions have changed. If so, redo the successor blocks.
            for (const level of Object.keys(ReferenceType)) {
                if (!oldDefsForLevel[level].equals(defsForLevel[level])) {
                    defsForLevelByBlock[level][block.id] = defsForLevel[level];
                    for (const succ of cfg.getSuccessors(block)) {
                        if (workQueue.indexOf(succ) < 0) {
                            workQueue.push(succ);
                        }
                    }
                }
            }
        }

        // Check to see if any of the undefined names were defined coming into the graph. If so,
        // don't report them as being undefined.
        if (namesDefined) {
            for (const ref of undefinedRefs.items) {
                if (namesDefined.items.some(n => n == ref.name)) {
                    undefinedRefs.remove(ref);
                }
            }
        }

        return {
            flows: dataflows,
            undefinedRefs: undefinedRefs
        };
    }

    public getDefs(statement: ast.ISyntaxNode, symbolTable: ISymbolTable): RefSet {
        let defs = new RefSet();
        if (!statement) { return defs; }

        /*
         * Assume by default that all names passed in as arguments to a function
         * an all objects that a function is called on are modified by that function call,
         * unless otherwise specified in the slice configuration.
         */
        const callNamesListener = new CallNamesListener(this._sliceConfiguration, statement);
        ast.walk(statement, callNamesListener);
        defs.add(...callNamesListener.defs.items);

        const defAnnotationsListener = new DefAnnotationListener(statement);
        ast.walk(statement, defAnnotationsListener);
        defs = defs.union(defAnnotationsListener.defs);

        switch (statement.type) {
            case ast.IMPORT: {
                const modnames = statement.names.map(i => i.name || i.path);
                symbolTable.moduleNames.add(...modnames);
                defs.add(
                    ...statement.names.map(nameNode => {
                        return {
                            type: SymbolType.IMPORT,
                            level: ReferenceType.DEFINITION,
                            name: nameNode.name || nameNode.path,
                            location: nameNode.location,
                            statement: statement
                        };
                    })
                );
                break;
            }
            case ast.FROM: {
                /*
                 * TODO(andrewhead): Discover definitions of symbols from wildcards, like {@code from <pkg> import *}.
                 */
                let modnames: Array<string> = [];
                if (statement.imports.constructor === Array) {
                    modnames = statement.imports.map(i => i.name || i.path);
                    symbolTable.moduleNames.add(...modnames);
                    defs.add(
                        ...statement.imports.map(i => {
                            return {
                                type: SymbolType.IMPORT,
                                level: ReferenceType.DEFINITION,
                                name: i.name || i.path,
                                location: i.location,
                                statement: statement
                            };
                        })
                    );
                }
                break;
            }
            case ast.ASSIGN: {
                const targetsDefListener = new TargetsDefListener(statement);
                if (statement.targets) {
                    for (const target of statement.targets) {
                        ast.walk(target, targetsDefListener);
                    }
                }
                defs = defs.union(targetsDefListener.defs);
                break;
            }
            case ast.DEF: {
                defs.add({
                    type: SymbolType.FUNCTION,
                    level: ReferenceType.DEFINITION,
                    name: statement.name,
                    location: statement.location,
                    statement: statement
                });
                break;
            }
            case ast.CLASS: {
                defs.add({
                    type: SymbolType.CLASS,
                    level: ReferenceType.DEFINITION,
                    name: statement.name,
                    location: statement.location,
                    statement: statement
                });
            }
            default:
                break;
        }
        return defs;
    }

    public getUses(statement: ast.ISyntaxNode, _: ISymbolTable): RefSet {
        let uses = new RefSet();

        switch (statement.type) {
            // TODO: should we collect when importing with FROM from something else that was already imported...
            case ast.ASSIGN: {
                // XXX: Is this supposed to union with funcArgs?
                const targetNames = gatherNames(statement.targets);
                const targets = new RefSet(
                    ...targetNames.items.map(([name, node]) => {
                        return {
                            type: SymbolType.VARIABLE,
                            level: ReferenceType.USE,
                            name: name,
                            location: node.location,
                            statement: statement
                        };
                    })
                );
                const sourceNames = gatherNames(statement.sources);
                const sources = new RefSet(
                    ...sourceNames.items.map(([name, node]) => {
                        return {
                            type: SymbolType.VARIABLE,
                            level: ReferenceType.USE,
                            name: name,
                            location: node.location,
                            statement: statement
                        };
                    })
                );
                uses = uses.union(sources).union(statement.op ? targets : new RefSet());
                break;
            }
            case ast.DEF:
                const defCfg = new ControlFlowGraph(statement);
                const argNames = new StringSet(
                    ...statement.params
                        .map(p => {
                            if (p && p instanceof Array && p.length > 0 && p[0].name) {
                                return p[0].name;
                            }
                        })
                        .filter(n => n != undefined)
                );
                const undefinedRefs = this.analyze(defCfg, this._sliceConfiguration, argNames).undefinedRefs;
                uses = undefinedRefs.filter(r => r.level == ReferenceType.USE);
                break;
            case ast.CLASS:
                break;
            default: {
                const usedNames = gatherNames(statement);
                uses = new RefSet(
                    ...usedNames.items.map(([name, node]) => {
                        return {
                            type: SymbolType.VARIABLE,
                            level: ReferenceType.USE,
                            name: name,
                            location: node.location,
                            statement: statement
                        };
                    })
                );
                break;
            }
        }

        return uses;
    }

    private _statementLocationKey(statement: ast.ISyntaxNode) {
        if (statement.cellExecutionEventId !== undefined) {
            return (`${statement.location.first_line},${statement.location.first_column},${statement.location.last_line},${statement.location.last_column},${statement.cellExecutionEventId}`);
        }
        return null;
    }
}

function locString(loc: ast.ILocation): string {
    return `${loc.first_line}:${loc.first_column}-${loc.last_line}:${loc.last_column}`;
}

export function sameLocation(loc1: ast.ILocation, loc2: ast.ILocation): boolean {
    return loc1.first_column === loc2.first_column && loc1.first_line === loc2.first_line && loc1.last_column === loc2.last_column && loc1.last_line === loc2.last_line;
}

function getNameSetId([name, node]: [string, ast.ISyntaxNode]) {
    if (!node.location) { console.log('***', node); }
    return `${name}@${locString(node.location)}`;
}

function gatherNames(node: ast.ISyntaxNode | ast.ISyntaxNode[]): NameSet {
    if (Array.isArray(node)) {
        return new NameSet().union(...node.map(gatherNames));
    } else {
        return new NameSet(
            ...ast
                .walk(node)
                .filter(e => e.type == ast.NAME)
                .map((e: ast.IName): [string, ast.ISyntaxNode] => [e.id, e])
        );
    }
}

function getDataflowId(df: IDataflow) {
    if (!df.fromNode.location) { console.log('*** FROM', df.fromNode, df.fromNode.location); }
    if (!df.toNode.location) { console.log('*** TO', df.toNode, df.toNode.location); }
    return `${locString(df.fromNode.location)}->${locString(df.toNode.location)}`;
}

function createFlowsFrom(fromSet: RefSet, toSet: RefSet, fromStatement: ast.ISyntaxNode): [Set<IDataflow>, Set<IRef>] {
    const refsDefined = new RefSet();
    const newFlows = new Set<IDataflow>(getDataflowId);
    for (const from of fromSet.items) {
        for (const to of toSet.items) {
            if (to.name == from.name) {
                refsDefined.add(from);
                newFlows.add({ fromNode: to.statement, toNode: fromStatement });
            }
        }
    }
    return [newFlows, refsDefined];
}

export type DataflowAnalysisResult = {
    flows: Set<IDataflow>;
    undefinedRefs: RefSet;
};
