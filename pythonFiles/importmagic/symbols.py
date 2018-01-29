"""Parse Python source and extract unresolved symbols."""

import ast
import sys
from contextlib import contextmanager
from itertools import chain

from importmagic.six import string_types
from importmagic.util import parse_ast


try:
    import builtins as __builtin__
except:
    import __builtin__


class _InvalidSymbol(Exception):
    pass


class Scope(object):
    GLOBALS = ['__name__', '__file__', '__loader__', '__package__', '__path__']
    PYTHON3_BUILTINS = ['PermissionError']
    ALL_BUILTINS = set(dir(__builtin__)) | set(GLOBALS) | set(PYTHON3_BUILTINS)

    def __init__(self, parent=None, define_builtins=True, is_class=False):
        self._parent = parent
        self._definitions = set()
        self._references = set()
        self._children = []
        self._cursors = [self]
        self._cursor = self
        self._define_builtins = define_builtins
        self._is_class = is_class
        if define_builtins:
            self._define_builtin_symbols()
        self._add_symbol = []
        self._symbol = []

    @contextmanager
    def start_symbol(self):
        self._add_symbol.append(self._add_symbol[-1] if self._add_symbol else self.reference)
        try:
            yield self
        finally:
            self.flush_symbol()

    @contextmanager
    def start_definition(self):
        self._add_symbol.append(self.define)
        try:
            yield self
        finally:
            self.flush_symbol()

    @contextmanager
    def start_reference(self):
        self._add_symbol.append(self.reference)
        try:
            yield self
        finally:
            self.flush_symbol()

    def extend_symbol(self, segment, extend_only=False):
        if extend_only and not self._symbol:
            return
        self._symbol.append(segment)

    def end_symbol(self):
        if self._symbol:
            add = self._add_symbol[-1] if self._add_symbol else self.reference
            add('.'.join(self._symbol))
            self._symbol = []

    def flush_symbol(self):
        self.end_symbol()
        if self._add_symbol:
            self._add_symbol.pop()

    @classmethod
    def from_source(cls, src, trace=False, define_builtins=True):
        scope = Scope(define_builtins=define_builtins)
        visitor = UnknownSymbolVisitor(scope, trace=trace)
        if isinstance(src, string_types):
            src = parse_ast(src)
        visitor.visit(src)
        scope.flush_symbol()
        return scope

    def _define_builtin_symbols(self):
        self._cursor._definitions.update(Scope.ALL_BUILTINS)

    def define(self, name):
        if '.' in name:
            self.reference(name)
        else:
            self._cursor._definitions.add(name)

    def reference(self, name):
        self._cursor._references.add(name)

    @contextmanager
    def enter(self, is_class=False):
        child = Scope(self._cursor, is_class=is_class, define_builtins=self._define_builtins)
        self._cursor._children.append(child)
        self._cursors.append(child)
        self._cursor = child
        try:
            yield child
        finally:
            child.end_symbol()
            self._cursors.pop()
            self._cursor = self._cursors[-1]

    def find_unresolved_and_unreferenced_symbols(self):
        """Find any unresolved symbols, and unreferenced symbols from this scope.

        :returns: ({unresolved}, {unreferenced})
        """
        unresolved = set()
        unreferenced = self._definitions.copy()
        self._collect_unresolved_and_unreferenced(set(), set(), unresolved, unreferenced,
                                                  frozenset(self._definitions), start=True)
        return unresolved, unreferenced - Scope.ALL_BUILTINS

    def _collect_unresolved_and_unreferenced(self, definitions, definitions_excluding_top,
                                             unresolved, unreferenced, top, start=False):
        scope_definitions = definitions | self._definitions
        scope_definitions_excluding_top = definitions_excluding_top | (set() if start else self._definitions)

        # When we're in a class, don't export definitions to descendant scopes
        if not self._is_class:
            definitions = scope_definitions
            definitions_excluding_top = scope_definitions_excluding_top

        for reference in self._references:
            symbols = set(_symbol_series(reference))
            # Symbol has no definition anywhere in ancestor scopes.
            if symbols.isdisjoint(scope_definitions):
                unresolved.add(reference)
            # Symbol is referenced only in the top level scope.
            elif not symbols.isdisjoint(top) and symbols.isdisjoint(scope_definitions_excluding_top):
                unreferenced -= symbols

        # Recurse
        for child in self._children:
            child._collect_unresolved_and_unreferenced(
                definitions, definitions_excluding_top, unresolved, unreferenced, top,
            )

    def __repr__(self):
        return 'Scope(definitions=%r, references=%r, children=%r)' \
            % (self._definitions - Scope.ALL_BUILTINS, self._references, self._children)


def _symbol_series(s):
    tokens = s.split('.')
    return ['.'.join(tokens[:n + 1]) for n in range(len(tokens))]


class UnknownSymbolVisitor(ast.NodeVisitor):
    def __init__(self, scope=None, trace=False):
        super(UnknownSymbolVisitor, self).__init__()
        self._scope = scope or Scope()
        self._trace = trace

    def visit(self, node):
        if node is None:
            return
        elif isinstance(node, list):
            for subnode in node:
                self.visit(subnode)
            return
        if self._trace:
            print(node, vars(node))
        method = getattr(self, 'visit_%s' % node.__class__.__name__, None)
        if method is not None:
            try:
                method(node)
            except Exception:
                # print >> sys.stderr, node, vars(node)
                raise
        else:
            self.generic_visit(node)
            self._scope.end_symbol()

    def visit_Raise(self, node):
        if hasattr(node, 'type'):  # Python 2: raise A[, B[, C]]
            with self._scope.start_reference():
                self.visit(node.type)
            with self._scope.start_reference():
                self.visit(node.inst)
            with self._scope.start_reference():
                self.visit(node.tback)
        else:                      # Python 3: raise A[ from B]
            with self._scope.start_reference():
                self.visit(node.exc)
            with self._scope.start_reference():
                self.visit(node.cause)

    def visit_TryExcept(self, node):
        for sub in node.body:
            with self._scope.start_reference():
                self.visit(sub)
        self.visit(node.handlers)
        for n in node.orelse:
            with self._scope.start_reference():
                self.visit(n)

    def visit_ExceptHandler(self, node):
        with self._scope.start_reference():
            self.visit(node.type)
        with self._scope.start_definition():
            if isinstance(node.name, str):
                # Python 3
                self._scope.extend_symbol(node.name)
            else:
                self.visit(node.name)
        for n in node.body:
            with self._scope.start_reference():
                self.visit(n)

    def visit_Return(self, node):
        with self._scope.start_reference():
            self.visit(node.value)

    def visit_If(self, node):
        with self._scope.start_reference():
            self.visit(node.test)
        for child in node.body:
            with self._scope.start_reference():
                self.visit(child)
        for child in node.orelse:
            with self._scope.start_reference():
                self.visit(child)

    def visit_While(self, node):
        return self.visit_If(node)

    def visit_FunctionDef(self, node):
        self._scope.define(node.name)
        self.visit_Lambda(node)

    def visit_Lambda(self, node):
        for decorator in getattr(node, 'decorator_list', []):
            with self._scope.start_reference() as scope:
                self.visit(decorator)
        with self._scope.enter() as scope:
            with scope.start_definition():
                args = node.args
                for arg in [args.kwarg, args.vararg]:
                    if arg:
                        # arg is either an "arg" object (Python 3.4+) or a str
                        scope.define(arg.arg if hasattr(arg, 'arg') else arg)
                # kwonlyargs was added in Python 3
                for arg in args.args + getattr(args, 'kwonlyargs', []):
                    scope.define(arg.id if hasattr(arg, 'id') else arg.arg)

                    # Python 3 arguments annotation
                    if hasattr(arg, 'annotation') and arg.annotation:
                        self.visit(arg.annotation)

                for default in args.defaults:
                    self.visit(default)
                
                # Python 3 return annotation
                if hasattr(node, 'returns'):
                    self.visit(node.returns)    
            body = [node.body] if isinstance(node, ast.Lambda) else node.body
            with scope.start_reference():
                for statement in body:
                    self.visit(statement)

    def visit_ListComp(self, node):
        return self.visit_GeneratorExp(node)

    def visit_Print(self, node):
        for value in node.values:
            with self._scope.start_reference():
                self.visit(value)
        if node.dest:
            with self._scope.start_reference():
                self.visit(node.dest)

    def visit_GeneratorExp(self, node):
        with self._scope.start_reference():
            self.visit(node.elt)
        for elt in node.generators:
            self.visit(elt)

    def visit_comprehension(self, node):
        with self._scope.start_definition():
            self.visit(node.target)
        with self._scope.start_reference():
            self.visit(node.iter)
        for elt in node.ifs:
            with self._scope.start_reference():
                self.visit(elt)

    def visit_Assign(self, node):
        for target in node.targets:
            with self._scope.start_definition():
                self.visit(target)
        with self._scope.start_reference():
            self.visit(node.value)

    def visit_ClassDef(self, node):
        for decorator in getattr(node, 'decorator_list', []):
            with self._scope.start_reference():
                self.visit(decorator)
        self._scope.define(node.name)
        for base in node.bases:
            with self._scope.start_reference():
                self.visit(base)
        with self._scope.enter(is_class=True):
            for body in node.body:
                with self._scope.start_reference():
                    self.visit(body)

    def visit_ImportFrom(self, node):
        for name in node.names:
            if name.name == '*':
                # TODO: Do something?
                continue
            symbol = name.asname or name.name.split('.')[0]
            self._scope.define(symbol)
            # Explicitly add a reference for __future__ imports so they don't
            # get pruned.
            if node.module == '__future__':
                self._scope.reference(symbol)
        self.generic_visit(node)

    def visit_Import(self, node):
        for name in node.names:
            self._scope.define(name.asname or name.name)
        self.generic_visit(node)

    def visit_With(self, node):
        if hasattr(node, 'items'):
            for item in node.items:
                self._visit_withitem(item)
        else:
            self._visit_withitem(node)
        with self._scope.start_reference():
            self.visit(node.body)

    def _visit_withitem(self, node):
        if node.optional_vars:
            with self._scope.start_definition():
                self.visit(node.optional_vars)
        with self._scope.start_reference():
            self.visit(node.context_expr)

    def visit_For(self, node):
        with self._scope.start_definition():
            self.visit(node.target)
        with self._scope.start_reference():
            self.visit(node.iter)
        with self._scope.start_reference():
            self.visit(node.body)
        with self._scope.start_reference():
            self.visit(node.orelse)

    def visit_Attribute(self, node, chain=False):
        if isinstance(node.value, ast.Name):
            self._scope.extend_symbol(node.value.id)
            self._scope.extend_symbol(node.attr)
            if not chain:
                self._scope.end_symbol()
        elif isinstance(node.value, ast.Attribute):
            self.visit_Attribute(node.value, chain=True)
            self._scope.extend_symbol(node.attr, extend_only=True)
        else:
            self._scope.end_symbol()
            self.visit(node.value)
            self._scope.end_symbol()

    def visit_Subscript(self, node):
        self._scope.end_symbol()
        with self._scope.start_reference():
            self.visit(node.value)
        self.visit(node.slice)

    def visit_Call(self, node):
        with self._scope.start_reference():
            self.visit(node.func)
        # Python 3.5 AST removed starargs and kwargs
        additional = []
        if getattr(node, 'starargs', None):
            additional.append(node.starargs)
        if getattr(node, 'kwargs', None):
            additional.append(node.kwargs)
        for arg in chain(node.args, node.keywords, additional):
            with self._scope.start_reference():
                self.visit(arg)

    def visit_Name(self, node):
        self._scope.extend_symbol(node.id)
        self._scope.end_symbol()


if __name__ == '__main__':
    with open(sys.argv[1]) as fd:
        scope = Scope.from_source(fd.read())
    unresolved, unreferenced = scope.find_unresolved_and_unreferenced_symbols()
    from pprint import pprint
    pprint(unresolved)
    pprint(unreferenced)
