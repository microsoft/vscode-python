import ast
import os
import re
import sys
from sys import platform
from ast import AST, iter_fields

from importmagic.six import text_type


CODING_COOKIE_RE = re.compile('(^\s*#.*)coding[:=]', re.M)


def parse_ast(source, filename=None):
    """Parse source into a Python AST, taking care of encoding."""
    if isinstance(source, text_type) and sys.version_info[0] == 2:
        # ast.parse() on Python 2 doesn't like encoding declarations
        # in Unicode strings
        source = CODING_COOKIE_RE.sub(r'\1', source, 1)
    return ast.parse(source, filename or '<unknown>')


def dump(node, annotate_fields=True, include_attributes=False, indent='  '):
    """Return a formatted dump of the tree in *node*.

    This is mainly useful for debugging purposes.  The returned string will
    show the names and the values for fields.  This makes the code impossible
    to evaluate, so if evaluation is wanted *annotate_fields* must be set to
    False.  Attributes such as line numbers and column offsets are not dumped
    by default.  If this is wanted, *include_attributes* can be set to True.
    """
    def _format(node, level=0):
        if isinstance(node, AST):
            fields = [(a, _format(b, level + 1)) for a, b in iter_fields(node)]
            if include_attributes and node._attributes:
                fields.extend([(a, _format(getattr(node, a), level + 1))
                               for a in node._attributes])
            return ''.join([
                node.__class__.__name__,
                '(\n' + indent + indent * level if fields else '(',
                (',\n' + indent + indent * level).join(('%s=%s' % field for field in fields)
                          if annotate_fields else
                          (b for a, b in fields)),
                ')'])
        elif isinstance(node, list):
            lines = ['[']
            lines.extend((indent * (level + 2) + _format(x, level + 2) + ','
                         for x in node))
            if len(lines) > 1:
                lines.append(indent * (level + 1) + ']')
            else:
                lines[-1] += ']'
            return '\n'.join(lines)
        return repr(node)

    if not isinstance(node, AST):
        raise TypeError('expected AST, got %r' % node.__class__.__name__)
    return _format(node)


def get_cache_dir():
    if platform.startswith('linux'):
        cache_dir = '~/.cache/importmagic/'
    elif platform == 'darwin':
        cache_dir = '~/Library/Caches/importmagic'
    elif platform in ('win32', 'cygwin'):
        cache_dir = '%APPDATA%\importmagic'

    cache_dir = os.path.expanduser(cache_dir)
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)

    return cache_dir
