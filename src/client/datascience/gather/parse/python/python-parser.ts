import { parse as python3Parse, parser } from './python3';

/**
 * Reset the lexer state after an error. Otherwise, parses after a failed parse can fail too.
 */
let yy = parser.yy as any;
let oldParseError = yy.parseError;
oldParseError = function(text: String, hash: any) {
    this.indents = [0];
    this.indent = 0;
    this.dedents = 0;
    this.brackets_count = 0;
    oldParseError.call(this, text, hash);
};

/**
 * This is the main interface for parsing code.
 * Call this instead of the `parse` method in python3.js.
 * If the `parse` method gets an error, all later calls will throw an error.
 * This method resets the state of the `parse` method so that doesn't happen.
 */
export function parse(program: string): IModule {
    if (program.charCodeAt(0) === 65279) {
        // eliminate byte order mark
        program = program.slice(1);
    }
    return python3Parse(program);
}

export type ISyntaxNode =
    | IModule
    | IImport
    | IFrom
    | IDecorator
    | IDecorate
    | IDef
    | IAssignment
    | IAssert
    | IReturn
    | IYield
    | IRaise
    | IContinue
    | IBreak
    | IGlobal
    | INonlocal
    | IIf
    | IElse
    | IWhile
    | IFor
    | ITry
    | IWith
    | ICall
    | IIndex
    | ISlice
    | IDot
    | IIfExpr
    | ICompFor
    | ICompIf
    | ILambda
    | IUnaryOperator
    | IBinaryOperator
    | IStarred
    | ITuple
    | IList
    | ISet
    | IDict
    | IName
    | ILiteral
    | IClass;

export interface ILocation {
    first_line: number;
    first_column: number;
    last_line: number;
    last_column: number;
}

export interface ILocatable {
    location: ILocation;
    cellExecutionEventId?: string;
}

export const MODULE = 'module';

export interface IModule extends ILocatable {
    type: typeof MODULE;
    code: ISyntaxNode[];
}

export const IMPORT = 'import';

export interface IImport extends ILocatable {
    type: typeof IMPORT;
    names: { path: string; name?: string; location: ILocation }[];
}

export const FROM = 'from';

export interface IFrom extends ILocatable {
    type: typeof FROM;
    imports: { path: string; name: string; location: ILocation }[];
}

export const DECORATOR = 'decorator';

export interface IDecorator extends ILocatable {
    type: typeof DECORATOR;
    decorator: string;
    args: ISyntaxNode[];
}

export const DECORATE = 'decorate';

export interface IDecorate extends ILocatable {
    type: typeof DECORATE;
    decorators: IDecorator[];
    def: ISyntaxNode;
}

export const DEF = 'def';

export interface IDef extends ILocatable {
    type: typeof DEF;
    name: string;
    params: IParam[];
    code: ISyntaxNode[];
}

export interface IParam {
    name: string;
    anno: ISyntaxNode;
    default_value: ISyntaxNode;
    star: boolean;
    starstar: boolean;
}

export const ASSIGN = 'assign';

export interface IAssignment extends ILocatable {
    type: typeof ASSIGN;
    op: string | undefined; // defined for augment e.g. +=
    targets: ISyntaxNode[];
    sources: ISyntaxNode[];
}

export const ASSERT = 'assert';

export interface IAssert extends ILocatable {
    type: typeof ASSERT;
    cond: ISyntaxNode;
    err: ISyntaxNode;
}

export const RETURN = 'return';

export interface IReturn extends ILocatable {
    type: typeof RETURN;
    value: ISyntaxNode[];
}

export const YIELD = 'yield';

export interface IYield extends ILocatable {
    type: typeof YIELD;
    value: ISyntaxNode[];
}

export const RAISE = 'raise';

export interface IRaise extends ILocatable {
    type: typeof RAISE;
    err: ISyntaxNode;
}

export const BREAK = 'break';

export interface IBreak extends ILocatable {
    type: typeof BREAK;
}

export const CONTINUE = 'continue';

export interface IContinue extends ILocatable {
    type: typeof CONTINUE;
}

export const GLOBAL = 'global';

export interface IGlobal extends ILocatable {
    type: typeof GLOBAL;
    names: string[];
}

export const NONLOCAL = 'nonlocal';

export interface INonlocal extends ILocatable {
    type: typeof NONLOCAL;
    names: string[];
}

export const IF = 'if';

export interface IIf extends ILocatable {
    type: typeof IF;
    cond: ISyntaxNode;
    code: ISyntaxNode[];
    elif: { cond: ISyntaxNode; code: ISyntaxNode[] }[];
    else: ISyntaxNode;
}

export const WHILE = 'while';

export interface IWhile extends ILocatable {
    type: typeof WHILE;
    cond: ISyntaxNode;
    code: ISyntaxNode[];
    else: ISyntaxNode[];
}

export const ELSE = 'else';

export interface IElse extends ILocatable {
    type: typeof ELSE;
    code: ISyntaxNode[];
}

export const FOR = 'for';

export interface IFor extends ILocatable {
    type: typeof FOR;
    target: ISyntaxNode[];
    iter: ISyntaxNode[];
    code: ISyntaxNode[];
    decl_location: ILocation;
}

export const COMPFOR = 'comp_for';

export interface ICompFor extends ILocatable {
    type: typeof COMPFOR;
    for: ISyntaxNode[];
    in: ISyntaxNode;
}

export const COMPIF = 'comp_if';

export interface ICompIf extends ILocatable {
    type: typeof COMPIF;
    test: ISyntaxNode;
}

export const TRY = 'try';

export interface ITry extends ILocatable {
    type: typeof TRY;
    code: ISyntaxNode[];
    excepts: { cond: ISyntaxNode; name: string; code: ISyntaxNode[] }[];
    else: ISyntaxNode[];
    finally: ISyntaxNode[];
}

export const WITH = 'with';

export interface IWith extends ILocatable {
    type: typeof WITH;
    items: { with: ISyntaxNode; as: ISyntaxNode }[];
    code: ISyntaxNode[];
}

export const CALL = 'call';

export interface ICall extends ILocatable {
    type: typeof CALL;
    func: ISyntaxNode;
    args: IArgument[];
}

export const ARG = 'arg';

export interface IArgument extends ILocatable {
    type: typeof ARG;
    actual: ISyntaxNode;
    keyword?: ISyntaxNode;
    loop?: ISyntaxNode;
}

export const INDEX = 'index';

export interface IIndex extends ILocatable {
    type: typeof INDEX;
    value: ISyntaxNode;
    args: ISyntaxNode[];
}

export const SLICE = 'slice';

export interface ISlice extends ILocatable {
    type: typeof SLICE;
    start?: ISyntaxNode;
    stop?: ISyntaxNode;
    step?: ISyntaxNode;
}

export const DOT = 'dot';

export interface IDot extends ILocatable {
    type: typeof DOT;
    value: ISyntaxNode;
    name: ISyntaxNode;
}

export const IFEXPR = 'ifexpr';

export interface IIfExpr extends ILocatable {
    type: typeof IFEXPR;
    test: ISyntaxNode;
    then: ISyntaxNode;
    else: ISyntaxNode;
}

export const LAMBDA = 'lambda';

export interface ILambda extends ILocatable {
    type: typeof LAMBDA;
    args: IParam[];
    code: ISyntaxNode;
}

export const UNOP = 'unop';

export interface IUnaryOperator extends ILocatable {
    type: typeof UNOP;
    op: string;
    operand: ISyntaxNode;
}

export const BINOP = 'binop';

export interface IBinaryOperator extends ILocatable {
    type: typeof BINOP;
    op: string;
    left: ISyntaxNode;
    right: ISyntaxNode;
}

export const STARRED = 'starred';

export interface IStarred extends ILocatable {
    type: typeof STARRED;
    value: ISyntaxNode;
}

export const TUPLE = 'tuple';

export interface ITuple extends ILocatable {
    type: typeof TUPLE;
    items: ISyntaxNode[];
}

export const LIST = 'list';

export interface IList extends ILocatable {
    type: typeof LIST;
    items: ISyntaxNode[];
}

export const SET = 'set';

export interface ISet extends ILocatable {
    type: typeof SET;
    entries: ISyntaxNode[];
    comp_for?: ISyntaxNode[];
}

export const DICT = 'dict';

export interface IDict extends ILocatable {
    type: typeof DICT;
    entries: { k: ISyntaxNode; v: ISyntaxNode }[];
    comp_for?: ISyntaxNode[];
}

export const NAME = 'name';

export interface IName extends ILocatable {
    type: typeof NAME;
    id: string;
}

export const LITERAL = 'literal';

export interface ILiteral extends ILocatable {
    type: typeof LITERAL;
    value: any;
}

export const CLASS = 'class';

export interface IClass extends ILocatable {
    type: typeof CLASS;
    name: string;
    extends: ISyntaxNode[];
    code: ISyntaxNode[];
}

function flatten<T>(arrayArrays: T[][]): T[] {
    return [].concat(...arrayArrays);
}

/**
 * Listener for pre-order traversal of the parse tree.
 */
export interface IWalkListener {
    /**
     * Called whenever a node is entered.
     */
    onEnterNode?(node: ISyntaxNode, type: string, ancestors: ISyntaxNode[]): void;

    /**
     * Called whenever a node is exited.
     */
    onExitNode?(node: ISyntaxNode, type: string, ancestors: ISyntaxNode[]): void;
}

/**
 * Preorder tree traversal with optional listener.
 */
export function walk(node: ISyntaxNode, walkListener?: IWalkListener): ISyntaxNode[] {
    return walkRecursive(node, [], walkListener);
}

/**
 * Recursive implementation of pre-order tree walk.
 */
function walkRecursive(node: ISyntaxNode, ancestors?: ISyntaxNode[], walkListener?: IWalkListener): ISyntaxNode[] {
    if (!node) {
        console.error('Node undefined. Ancestors:', ancestors);
        return [];
    }

    ancestors.push(node);

    if (walkListener && walkListener.onEnterNode) {
        walkListener.onEnterNode(node, node.type, ancestors);
    }

    let children: ISyntaxNode[] = [];
    switch (node.type) {
        case MODULE:
        case DEF:
        case CLASS:
            children = node.code;
            break;
        case IF:
            children = [node.cond]
                .concat(node.code)
                .concat(node.elif ? flatten(node.elif.map(e => [e.cond].concat(e.code))) : [])
                .concat(node.else ? [node.else] : []);
            break;
        case ELSE:
            children = node.code;
            break;
        case WHILE:
            children = [node.cond].concat(node.code);
            break;
        case WITH:
            children = flatten(node.items.map(r => [r.with, r.as])).concat(node.code);
            break;
        case FOR:
            children = node.iter.concat(node.target).concat(node.code);
            break;
        case TRY:
            children = node.code
                .concat(flatten((node.excepts || []).map(e => (e.cond ? [e.cond] : []).concat(e.code))))
                .concat(node.else || [])
                .concat(node.finally || []);
            break;
        case DECORATE:
            children = [node.def];
            break;
        case LAMBDA:
            children = [node.code];
            break;
        case CALL:
            children = [node.func].concat(node.args.map(a => a.actual));
            break;
        case IFEXPR:
            children = [node.test, node.then, node.else];
            break;
        case COMPFOR:
            children = node.for.concat([node.in]);
            break;
        case UNOP:
            children = [node.operand];
            break;
        case BINOP:
            children = [node.left, node.right];
            break;
        case STARRED:
            children = [node.value];
            break;
        case SET:
            children = node.entries.concat(node.comp_for ? node.comp_for : []);
            break;
        case LIST:
            children = node.items;
            break;
        case TUPLE:
            children = node.items;
            break;
        case DICT:
            children = flatten(node.entries.map(p => [p.k, p.v])).concat(node.comp_for ? node.comp_for : []);
            break;
        case ASSIGN:
            if (!node.sources) console.log(node);
            children = node.sources.concat(node.targets);
            break;
        case ASSERT:
            children = [node.cond].concat(node.err ? [node.err] : []);
            break;
        case DOT:
            children = [node.value, node.name];
            break;
        case INDEX:
            children = [node.value].concat(node.args);
            break;
        case SLICE:
            children = (node.start ? [node.start] : []).concat(node.stop ? [node.stop] : []).concat(node.step ? [node.step] : []);
            break;
        case COMPFOR:
            children = node.for.concat([node.in]);
            break;
        case COMPIF:
            children = [node.test];
            break;
        case YIELD:
            children = node.value ? node.value : [];
            break;
        case RETURN:
            children = node.value ? node.value : [];
            break;
        case RAISE:
            children = node.err ? [node.err] : [];
            break;
        case IFEXPR:
            children = [node.test, node.then, node.else];
            break;
    }

    let nodes = [node];
    if (children.some(c => !c)) {
        console.log('BAD CHILDREN', node);
    }
    let subtreeNodes = flatten(children.map(node => walkRecursive(node, ancestors, walkListener)));
    nodes = nodes.concat(subtreeNodes);

    if (walkListener && walkListener.onExitNode) {
        walkListener.onExitNode(node, node.type, ancestors);
    }

    ancestors.pop();
    return nodes;
}
