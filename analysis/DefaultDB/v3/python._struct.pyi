import builtins
import struct

Struct = builtins.Struct
__doc__ = "Functions to convert between Python values and C structs.\nPython bytes objects are used to hold the data representing the C struct\nand also as format strings (explained below) to describe the layout of data\nin the C struct.\n\nThe optional first format char indicates byte order, size and alignment:\n  @: native order, size & alignment (default)\n  =: native order, std. size & alignment\n  <: little-endian, std. size & alignment\n  >: big-endian, std. size & alignment\n  !: same as >\n\nThe remaining chars indicate types of args and must match exactly;\nthese can be preceded by a decimal repeat count:\n  x: pad byte (no data); c:char; b:signed byte; B:unsigned byte;\n  ?: _Bool (requires C99; if not available, char is used instead)\n  h:short; H:unsigned short; i:int; I:unsigned int;\n  l:long; L:unsigned long; f:float; d:double; e:half-float.\nSpecial cases (preceding decimal count indicates length):\n  s:string (array of char); p: pascal string (with count byte).\nSpecial cases (only available in native format):\n  n:ssize_t; N:size_t;\n  P:an integer type that is wide enough to hold a pointer.\nSpecial case (not in native mode unless 'long long' in platform C):\n  q:long long; Q:unsigned long long\nWhitespace between formats is ignored.\n\nThe variable struct.error is an exception raised on errors.\n"
__name__ = '_struct'
__package__ = ''
def _clearcache():
    'Clear the internal cache.'
    pass

def calcsize(fmt):
    'calcsize(fmt) -> integer\n\nReturn size in bytes of the struct described by the format string fmt.'
    pass

error = struct.error
def iter_unpack(fmt, buffer):
    'iter_unpack(fmt, buffer) -> iterator(v1, v2, ...)\n\nReturn an iterator yielding tuples unpacked from the given bytes\nsource according to the format string, like a repeated invocation of\nunpack_from().  Requires that the bytes length be a multiple of the\nformat struct size.'
    pass

def pack():
    'pack(fmt, v1, v2, ...) -> bytes\n\nReturn a bytes object containing the values v1, v2, ... packed according\nto the format string fmt.  See help(struct) for more on format strings.'
    pass

def pack_into():
    'pack_into(fmt, buffer, offset, v1, v2, ...)\n\nPack the values v1, v2, ... according to the format string fmt and write\nthe packed bytes into the writable buffer buf starting at offset.  Note\nthat the offset is a required argument.  See help(struct) for more\non format strings.'
    pass

def unpack(fmt, buffer):
    "unpack(fmt, buffer) -> (v1, v2, ...)\n\nReturn a tuple containing values unpacked according to the format string\nfmt.  The buffer's size in bytes must be calcsize(fmt). See help(struct)\nfor more on format strings."
    pass

def unpack_from(fmt, buffer, offset=0):
    "unpack_from(fmt, buffer, offset=0) -> (v1, v2, ...)\n\nReturn a tuple containing values unpacked according to the format string\nfmt.  The buffer's size, minus offset, must be at least calcsize(fmt).\nSee help(struct) for more on format strings."
    pass

