"""Imports new symbols."""

import os
import tokenize
from collections import defaultdict
try:
    from ConfigParser import ConfigParser
except:
    from configparser import ConfigParser

from importmagic.six import StringIO


class Iterator(object):
    def __init__(self, tokens, start=None, end=None):
        self._tokens = tokens
        self._cursor = start or 0
        self._end = end or len(self._tokens)

    def rewind(self):
        self._cursor -= 1

    def next(self):
        if not self:
            return None, None
        token = self._tokens[self._cursor]
        index = self._cursor
        self._cursor += 1
        return index, token

    def peek(self):
        return self._tokens[self._cursor] if self else None

    def until(self, type):
        tokens = []
        while self:
            index, token = self.next()
            tokens.append((index, token))
            if type == token[0]:
                break
        return tokens

    def __nonzero__(self):
        return self._cursor < self._end
    __bool__ = __nonzero__


class Import(object):
    def __init__(self, location, name, alias):
        self.location = location
        self.name = name
        self.alias = alias

    def __repr__(self):
        return 'Import(location=%r, name=%r, alias=%r)' % \
            (self.location, self.name, self.alias)

    def __hash__(self):
        return hash((self.location, self.name, self.alias))

    def __eq__(self, other):
        return self.location == other.location and self.name == other.name and self.alias == other.alias

    def __ne__(self, other):
        return not (self == other)

    def __lt__(self, other):
        return self.location < other.location \
            or self.name < other.name \
            or (self.alias is not None and other.alias is not None and self.alias < other.alias)


# See SymbolIndex.LOCATIONS for details.
LOCATION_ORDER = 'FS3L'

PROJECT_CONFIG_FILE = 'setup.cfg'


class Imports(object):

    _style = {'multiline': 'parentheses', 'max_columns': 79}

    def __init__(self, index, source, root_dir=None):
        self._imports = set()
        self._imports_from = defaultdict(set)
        self._imports_begin = self._imports_end = None
        self._source = source
        self._index = index
        self._root_dir = root_dir
        self._parse(source)
        if root_dir:
            style = self.get_style_from_config()
            self._style.update(style)

    @classmethod
    def set_style(cls, **kwargs):
        cls._style.update(kwargs)

    def get_style_from_config(self):
        style = {}
        cfg_path = os.path.join(self._root_dir, PROJECT_CONFIG_FILE)
        config = ConfigParser()
        config.read([cfg_path])
        imp_cfg = config['importmagic']

        if imp_cfg['multiline']:
            style['multiline'] = imp_cfg['multiline']
        if imp_cfg['max_columns']:
            style['max_columns'] = int(imp_cfg['max_columns'])
        return style

    def add_import(self, name, alias=None):
        location = LOCATION_ORDER.index(self._index.location_for(name))
        self._imports.add(Import(location, name, alias))

    def add_import_from(self, module, name, alias=None):
        location = LOCATION_ORDER.index(self._index.location_for(module))
        self._imports_from[module].add(Import(location, name, alias))

    def remove(self, references):
        for imp in list(self._imports):
            if imp.name in references:
                self._imports.remove(imp)
        for name, imports in self._imports_from.items():
            for imp in list(imports):
                if imp.name in references:
                    imports.remove(imp)

    def get_update(self):
        groups = []
        for expected_location in range(len(LOCATION_ORDER)):
            out = StringIO()
            for imp in sorted(self._imports):
                if expected_location != imp.location:
                    continue
                out.write('import {module}{alias}\n'.format(
                    module=imp.name,
                    alias=' as {alias}'.format(alias=imp.alias) if imp.alias else '',
                ))

            for module, imports in sorted(self._imports_from.items()):
                imports = sorted(imports)
                if not imports or expected_location != imports[0].location:
                    continue
                line = 'from {module} import '.format(module=module)
                clauses = ['{name}{alias}'.format(
                           name=i.name,
                           alias=' as {alias}'.format(alias=i.alias) if i.alias else ''
                           ) for i in imports]
                clauses.reverse()
                line_len = len(line)
                line_pieces = []
                paren_used = False
                while clauses:
                    clause = clauses.pop()
                    next_len = line_len + len(clause) + 2
                    if next_len > self._style['max_columns']:
                        imported_items = ', '.join(line_pieces)
                        if self._style['multiline'] == 'parentheses':
                            line_tail = ',\n'
                            if not paren_used:
                                line += '('
                                paren_used = True
                            line_pieces.append('\n')
                        else:
                            # Use a backslash
                            line_tail = ', \\\n'
                        out.write(line + imported_items + line_tail)
                        line = '    '
                        line_len = len(line) + len(clause) + 2
                        line_pieces = [clause]
                    else:
                        line_pieces.append(clause)
                        line_len = next_len
                line += ', '.join(line_pieces) + (')\n' if paren_used else '\n')
                if line.strip():
                    out.write(line)

            text = out.getvalue()
            if text:
                groups.append(text)

        start = self._tokens[self._imports_begin][2][0] - 1
        end = self._tokens[min(len(self._tokens) - 1, self._imports_end)][2][0] - 1
        if groups:
            text = '\n'.join(groups) + '\n\n'
        else:
            text = ''
        return start, end, text

    def update_source(self):
        start, end, text = self.get_update()
        lines = self._source.splitlines()
        lines[start:end] = text.splitlines()
        return '\n'.join(lines) + '\n'

    def _parse(self, source):
        reader = StringIO(source)
        # parse until EOF or TokenError (allows incomplete modules)
        tokens = []
        try:
            tokens.extend(tokenize.generate_tokens(reader.readline))
        except tokenize.TokenError:
            # TokenError happens always at EOF, for unclosed strings or brackets.
            # We don't care about that here, since we still can recover the whole
            # source code.
            pass
        self._tokens = tokens
        it = Iterator(self._tokens)
        self._imports_begin, self._imports_end = self._find_import_range(it)
        it = Iterator(self._tokens, start=self._imports_begin, end=self._imports_end)
        self._parse_imports(it)

    def _find_import_range(self, it):
        ranges = self._find_import_ranges(it)
        start, end = ranges[0][1:]
        return start, end

    def _find_import_ranges(self, it):
        ranges = []
        indentation = 0
        explicit = False
        size = 0
        start = None
        potential_end_index = -1

        while it:
            index, token = it.next()

            if token[0] == tokenize.INDENT:
                indentation += 1
                continue
            elif token[0] == tokenize.DEDENT:
                indentation += 1
                continue

            if indentation:
                continue

            # Explicitly tell importmagic to manage the following block of imports
            if token[1] == '# importmagic: manage':
                ranges = []
                start = index + 2  # Start managing imports after directive comment + newline.
                explicit = True
                continue
            elif token[0] in (tokenize.STRING, tokenize.COMMENT):
                # If a non-import statement follows, stop the range *before*
                # this string or comment, in order to keep it out of the
                # updated import block.
                if potential_end_index == -1:
                    potential_end_index = index
                continue
            elif token[0] in (tokenize.NEWLINE, tokenize.NL):
                continue

            if not ranges:
                ranges.append((0, index, index))

            # Accumulate imports
            if token[1] in ('import', 'from'):
                potential_end_index = -1
                if start is None:
                    start = index
                size += 1
                while it:
                    token = it.peek()
                    if token[0] == tokenize.NEWLINE or token[1] == ';':
                        break
                    index, _ = it.next()

            # Terminate this import range
            elif start is not None and token[1].strip():
                if potential_end_index > -1:
                    index = potential_end_index
                    potential_end_index = -1
                ranges.append((size, start, index))

                start = None
                size = 0
                if explicit:
                    break

        if start is not None:
            ranges.append((size, start, index))
        ranges.sort(reverse=True)
        return ranges

    def _parse_imports(self, it):
        while it:
            index, token = it.next()

            if token[1] not in ('import', 'from') and token[1].strip():
                continue

            type = token[1]
            if type in ('import', 'from'):
                tokens = it.until(tokenize.NEWLINE)
                tokens = [
                    t[1] for i, t in tokens
                    if t[0] == tokenize.NAME or t[1] in (',', '.', '...')]
                tokens.reverse()
                self._parse_import(type, tokens)

    def _parse_import(self, type, tokens):
        module = None
        if type == 'from':
            module = ''
            while tokens and tokens[-1] != 'import':
                module += tokens.pop()
            assert tokens.pop() == 'import'
        while tokens:
            name = ''
            while True:
                name += tokens.pop()
                next = tokens.pop() if tokens else None
                if next == '.':
                    name += next
                else:
                    break

            alias = None
            if next == 'as':
                alias = tokens.pop()
                if alias == name:
                    alias = None
                next = tokens.pop() if tokens else None
            if next == ',':
                pass
            if type == 'import':
                self.add_import(name, alias=alias)
            else:
                self.add_import_from(module, name, alias=alias)

    def __repr__(self):
        return 'Imports(imports=%r, imports_from=%r)' % (self._imports, self._imports_from)


def _process_imports(src, index, unresolved, unreferenced, project_root):
    imports = Imports(index, src, project_root)
    imports.remove(unreferenced)
    for symbol in unresolved:
        scores = index.symbol_scores(symbol)
        if not scores:
            continue
        _, module, variable = scores[0]
        # Direct module import: eg. os.path
        if variable is None:
            # sys.path              sys path          ->    import sys
            # os.path.basename      os.path basename  ->    import os.path
            imports.add_import(module)
        else:
            # basename              os.path basename   ->   from os.path import basename
            # path.basename         os.path basename   ->   from os import path
            imports.add_import_from(module, variable)
    return imports


def get_update(src, index, unresolved, unreferenced, project_root=None):
    imports = _process_imports(src, index, unresolved, unreferenced, project_root)
    return imports.get_update()


def update_imports(src, index, unresolved, unreferenced, project_root=None):
    imports = _process_imports(src, index, unresolved, unreferenced, project_root)
    return imports.update_source()
