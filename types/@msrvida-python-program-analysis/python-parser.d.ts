/**
 * This is the main interface for parsing code.
 * Call this instead of the `parse` method in python3.js.
 * If the `parse` method gets an error, all later calls will throw an error.
 * This method resets the state of the `parse` method so that doesn't happen.
 */
export declare function parse(program: string): Module;
export declare type SyntaxNode = Module | Import | From | Decorator | Decorate | Def | Parameter | Assignment | Delete | Assert | Pass | Return | Yield | Raise | Continue | Break | Global | Nonlocal | If | Else | While | For | Try | With | Call | Index | Slice | Dot | IfExpr | CompFor | CompIf | Lambda | UnaryOperator | BinaryOperator | Starred | Tuple | ListExpr | SetExpr | DictExpr | Name | Literal | Class | Argument;
interface JisonLocation {
    first_line: number;
    first_column: number;
    last_line: number;
    last_column: number;
}
export interface Location extends JisonLocation {
    path?: string;
}
export declare function locationString(loc: Location): string;
export declare function locationContains(loc1: Location, loc2: Location): boolean;
export interface Locatable {
    location: Location;
    cellId?: string;
    executionCount?: number;
}
export declare const MODULE = "module";
export interface Module extends Locatable {
    type: typeof MODULE;
    code: SyntaxNode[];
}
export declare const IMPORT = "import";
export interface Import extends Locatable {
    type: typeof IMPORT;
    names: {
        path: string;
        alias?: string;
        location: Location;
    }[];
}
export declare const FROM = "from";
export interface From extends Locatable {
    type: typeof FROM;
    base: string;
    imports: {
        name: string;
        alias: string;
        location: Location;
    }[];
}
export declare const DECORATOR = "decorator";
export interface Decorator extends Locatable {
    type: typeof DECORATOR;
    decorator: string;
    args: SyntaxNode[];
}
export declare const DECORATE = "decorate";
export interface Decorate extends Locatable {
    type: typeof DECORATE;
    decorators: Decorator[];
    def: SyntaxNode;
}
export declare const DEF = "def";
export interface Def extends Locatable {
    type: typeof DEF;
    name: string;
    params: Parameter[];
    code: SyntaxNode[];
}
export declare const PARAMETER = "parameter";
export interface Parameter extends Locatable {
    type: typeof PARAMETER;
    name: string;
    anno: SyntaxNode;
    default_value: SyntaxNode;
    star: boolean;
    starstar: boolean;
}
export declare const ASSIGN = "assign";
export interface Assignment extends Locatable {
    type: typeof ASSIGN;
    op: string | undefined;
    targets: SyntaxNode[];
    sources: SyntaxNode[];
}
export declare const DEL = "del";
export interface Delete extends Locatable {
    type: typeof DEL;
    targets: SyntaxNode[];
}
export declare const ASSERT = "assert";
export interface Assert extends Locatable {
    type: typeof ASSERT;
    cond: SyntaxNode;
    err: SyntaxNode;
}
export declare const PASS = "pass";
export interface Pass extends Locatable {
    type: typeof PASS;
}
export declare const RETURN = "return";
export interface Return extends Locatable {
    type: typeof RETURN;
    values: SyntaxNode[];
}
export declare const YIELD = "yield";
export interface Yield extends Locatable {
    type: typeof YIELD;
    value: SyntaxNode[];
    from?: SyntaxNode;
}
export declare const RAISE = "raise";
export interface Raise extends Locatable {
    type: typeof RAISE;
    err: SyntaxNode;
}
export declare const BREAK = "break";
export interface Break extends Locatable {
    type: typeof BREAK;
}
export declare const CONTINUE = "continue";
export interface Continue extends Locatable {
    type: typeof CONTINUE;
}
export declare const GLOBAL = "global";
export interface Global extends Locatable {
    type: typeof GLOBAL;
    names: string[];
}
export declare const NONLOCAL = "nonlocal";
export interface Nonlocal extends Locatable {
    type: typeof NONLOCAL;
    names: string[];
}
export declare const IF = "if";
export interface If extends Locatable {
    type: typeof IF;
    cond: SyntaxNode;
    code: SyntaxNode[];
    elif: {
        cond: SyntaxNode;
        code: SyntaxNode[];
    }[];
    else: Else;
}
export declare const WHILE = "while";
export interface While extends Locatable {
    type: typeof WHILE;
    cond: SyntaxNode;
    code: SyntaxNode[];
    else: SyntaxNode[];
}
export declare const ELSE = "else";
export interface Else extends Locatable {
    type: typeof ELSE;
    code: SyntaxNode[];
}
export declare const FOR = "for";
export interface For extends Locatable {
    type: typeof FOR;
    target: SyntaxNode[];
    iter: SyntaxNode[];
    code: SyntaxNode[];
    else?: SyntaxNode[];
    decl_location: Location;
}
export declare const COMPFOR = "comp_for";
export interface CompFor extends Locatable {
    type: typeof COMPFOR;
    for: SyntaxNode[];
    in: SyntaxNode;
}
export declare const COMPIF = "comp_if";
export interface CompIf extends Locatable {
    type: typeof COMPIF;
    test: SyntaxNode;
}
export declare const TRY = "try";
export interface Try extends Locatable {
    type: typeof TRY;
    code: SyntaxNode[];
    excepts: {
        cond: SyntaxNode;
        name: string;
        code: SyntaxNode[];
    }[];
    else: SyntaxNode[];
    finally: SyntaxNode[];
}
export declare const WITH = "with";
export interface With extends Locatable {
    type: typeof WITH;
    items: {
        with: SyntaxNode;
        as: SyntaxNode;
    }[];
    code: SyntaxNode[];
}
export declare const CALL = "call";
export interface Call extends Locatable {
    type: typeof CALL;
    func: SyntaxNode;
    args: Argument[];
}
export declare const ARG = "arg";
export interface Argument extends Locatable {
    type: typeof ARG;
    actual: SyntaxNode;
    keyword?: SyntaxNode;
    loop?: CompFor;
    varargs?: boolean;
    kwargs?: boolean;
}
export declare const INDEX = "index";
export interface Index extends Locatable {
    type: typeof INDEX;
    value: SyntaxNode;
    args: SyntaxNode[];
}
export declare const SLICE = "slice";
export interface Slice extends Locatable {
    type: typeof SLICE;
    start?: SyntaxNode;
    stop?: SyntaxNode;
    step?: SyntaxNode;
}
export declare const DOT = "dot";
export interface Dot extends Locatable {
    type: typeof DOT;
    value: SyntaxNode;
    name: string;
}
export declare const IFEXPR = "ifexpr";
export interface IfExpr extends Locatable {
    type: typeof IFEXPR;
    test: SyntaxNode;
    then: SyntaxNode;
    else: SyntaxNode;
}
export declare const LAMBDA = "lambda";
export interface Lambda extends Locatable {
    type: typeof LAMBDA;
    args: Parameter[];
    code: SyntaxNode;
}
export declare const UNOP = "unop";
export interface UnaryOperator extends Locatable {
    type: typeof UNOP;
    op: string;
    operand: SyntaxNode;
}
export declare const BINOP = "binop";
export interface BinaryOperator extends Locatable {
    type: typeof BINOP;
    op: string;
    left: SyntaxNode;
    right: SyntaxNode;
}
export declare const STARRED = "starred";
export interface Starred extends Locatable {
    type: typeof STARRED;
    value: SyntaxNode;
}
export declare const TUPLE = "tuple";
export interface Tuple extends Locatable {
    type: typeof TUPLE;
    items: SyntaxNode[];
}
export declare const LIST = "list";
export interface ListExpr extends Locatable {
    type: typeof LIST;
    items: SyntaxNode[];
}
export declare const SET = "set";
export interface SetExpr extends Locatable {
    type: typeof SET;
    entries: SyntaxNode[];
    comp_for?: SyntaxNode[];
}
export declare const DICT = "dict";
export interface DictExpr extends Locatable {
    type: typeof DICT;
    entries: {
        k: SyntaxNode;
        v: SyntaxNode;
    }[];
    comp_for?: SyntaxNode[];
}
export declare const NAME = "name";
export interface Name extends Locatable {
    type: typeof NAME;
    id: string;
}
export declare const LITERAL = "literal";
export interface Literal extends Locatable {
    type: typeof LITERAL;
    value: any;
}
export declare const CLASS = "class";
export interface Class extends Locatable {
    type: typeof CLASS;
    name: string;
    extends: SyntaxNode[];
    code: SyntaxNode[];
}
/**
 * returns whether two syntax nodes are semantically equivalent
 */
export declare function isEquivalent(node1: SyntaxNode, node2: SyntaxNode): boolean;
export declare function flatten<T>(arrayArrays: T[][]): T[];
/**
 * Listener for pre-order traversal of the parse tree.
 */
export interface WalkListener {
    /**
     * Called whenever a node is entered.
     */
    onEnterNode?(node: SyntaxNode, ancestors: SyntaxNode[]): void;
    /**
     * Called whenever a node is exited.
     */
    onExitNode?(node: SyntaxNode, ancestors: SyntaxNode[]): void;
}
/**
 * Preorder tree traversal with optional listener.
 */
export declare function walk(node: SyntaxNode, walkListener?: WalkListener): SyntaxNode[];
export {};
