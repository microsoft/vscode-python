import __builtin__
import struct

Struct = __builtin__.Struct
_PY_STRUCT_FLOAT_COERCE = 1
_PY_STRUCT_RANGE_CHECKING = 1
__doc__ = "Functions to convert between Python values and C structs represented\nas Python strings. It uses format strings (explained below) as compact\ndescriptions of the lay-out of the C structs and the intended conversion\nto/from Python values.\n\nThe optional first format char indicates byte order, size and alignment:\n  @: native order, size & alignment (default)\n  =: native order, std. size & alignment\n  <: little-endian, std. size & alignment\n  >: big-endian, std. size & alignment\n  !: same as >\n\nThe remaining chars indicate types of args and must match exactly;\nthese can be preceded by a decimal repeat count:\n  x: pad byte (no data); c:char; b:signed byte; B:unsigned byte;\n  ?: _Bool (requires C99; if not available, char is used instead)\n  h:short; H:unsigned short; i:int; I:unsigned int;\n  l:long; L:unsigned long; f:float; d:double.\nSpecial cases (preceding decimal count indicates length):\n  s:string (array of char); p: pascal string (with count byte).\nSpecial case (only available in native format):\n  P:an integer type that is wide enough to hold a pointer.\nSpecial case (not in native mode unless 'long long' in platform C):\n  q:long long; Q:unsigned long long\nWhitespace between formats is ignored.\n\nThe variable struct.error is an exception raised on errors.\n"
__name__ = '_struct'
__package__ = None
__version__ = '0.2'
def _clearcache():
    'Clear the internal cache.'
    pass

def calcsize():
    'Return size of C struct described by format string fmt.'
    pass

error = struct.error
def pack():
    'Return string containing values v1, v2, ... packed according to fmt.'
    pass

def pack_into():
    'Pack the values v1, v2, ... according to fmt.\nWrite the packed bytes into the writable buffer buf starting at offset.'
    pass

def unpack():
    'Unpack the string containing packed C structure data, according to fmt.\nRequires len(string) == calcsize(fmt).'
    pass

def unpack_from():
    'Unpack the buffer, containing packed C structure data, according to\nfmt, starting at offset. Requires len(buffer[offset:]) >= calcsize(fmt).'
    pass

