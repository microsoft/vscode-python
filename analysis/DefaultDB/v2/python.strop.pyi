__doc__ = 'Common string manipulations, optimized for speed.\n\nAlways use "import string" rather than referencing\nthis module directly.'
__name__ = 'strop'
__package__ = None
def atof(s):
    'atof(s) -> float\n\nReturn the floating point number represented by the string s.'
    pass

def atoi(s, base):
    'atoi(s [,base]) -> int\n\nReturn the integer represented by the string s in the given\nbase, which defaults to 10.  The string s must consist of one\nor more digits, possibly preceded by a sign.  If base is 0, it\nis chosen from the leading characters of s, 0 for octal, 0x or\n0X for hexadecimal.  If base is 16, a preceding 0x or 0X is\naccepted.'
    pass

def atol(s, base):
    'atol(s [,base]) -> long\n\nReturn the long integer represented by the string s in the\ngiven base, which defaults to 10.  The string s must consist\nof one or more digits, possibly preceded by a sign.  If base\nis 0, it is chosen from the leading characters of s, 0 for\noctal, 0x or 0X for hexadecimal.  If base is 16, a preceding\n0x or 0X is accepted.  A trailing L or l is not accepted,\nunless base is 0.'
    pass

def capitalize(s):
    'capitalize(s) -> string\n\nReturn a copy of the string s with only its first character\ncapitalized.'
    pass

def count(s, sub, start, end):
    'count(s, sub[, start[, end]]) -> int\n\nReturn the number of occurrences of substring sub in string\ns[start:end].  Optional arguments start and end are\ninterpreted as in slice notation.'
    pass

def expandtabs(string, tabsize):
    "expandtabs(string, [tabsize]) -> string\n\nExpand tabs in a string, i.e. replace them by one or more spaces,\ndepending on the current column and the given tab size (default 8).\nThe column number is reset to zero after each newline occurring in the\nstring.  This doesn't understand other non-printing characters."
    pass

def find(s, sub, start, end):
    'find(s, sub [,start [,end]]) -> in\n\nReturn the lowest index in s where substring sub is found,\nsuch that sub is contained within s[start,end].  Optional\narguments start and end are interpreted as in slice notation.\n\nReturn -1 on failure.'
    pass

def join(list, sep):
    'join(list [,sep]) -> string\njoinfields(list [,sep]) -> string\n\nReturn a string composed of the words in list, with\nintervening occurrences of sep.  Sep defaults to a single\nspace.\n\n(join and joinfields are synonymous)'
    pass

def joinfields():
    'join(list [,sep]) -> string\njoinfields(list [,sep]) -> string\n\nReturn a string composed of the words in list, with\nintervening occurrences of sep.  Sep defaults to a single\nspace.\n\n(join and joinfields are synonymous)'
    pass

def lower(s):
    'lower(s) -> string\n\nReturn a copy of the string s converted to lowercase.'
    pass

lowercase = 'abcdefghijklmnopqrstuvwxyz'
def lstrip(s):
    'lstrip(s) -> string\n\nReturn a copy of the string s with leading whitespace removed.'
    pass

def maketrans(frm, to):
    'maketrans(frm, to) -> string\n\nReturn a translation table (a string of 256 bytes long)\nsuitable for use in string.translate.  The strings frm and to\nmust be of the same length.'
    pass

def replace(str, old, new, maxsplit):
    'replace (str, old, new[, maxsplit]) -> string\n\nReturn a copy of string str with all occurrences of substring\nold replaced by new. If the optional argument maxsplit is\ngiven, only the first maxsplit occurrences are replaced.'
    pass

def rfind(s, sub, start, end):
    'rfind(s, sub [,start [,end]]) -> int\n\nReturn the highest index in s where substring sub is found,\nsuch that sub is contained within s[start,end].  Optional\narguments start and end are interpreted as in slice notation.\n\nReturn -1 on failure.'
    pass

def rstrip(s):
    'rstrip(s) -> string\n\nReturn a copy of the string s with trailing whitespace removed.'
    pass

def split(s, sep, maxsplit):
    'split(s [,sep [,maxsplit]]) -> list of strings\nsplitfields(s [,sep [,maxsplit]]) -> list of strings\n\nReturn a list of the words in the string s, using sep as the\ndelimiter string.  If maxsplit is nonzero, splits into at most\nmaxsplit words.  If sep is not specified, any whitespace string\nis a separator.  Maxsplit defaults to 0.\n\n(split and splitfields are synonymous)'
    pass

def splitfields():
    'split(s [,sep [,maxsplit]]) -> list of strings\nsplitfields(s [,sep [,maxsplit]]) -> list of strings\n\nReturn a list of the words in the string s, using sep as the\ndelimiter string.  If maxsplit is nonzero, splits into at most\nmaxsplit words.  If sep is not specified, any whitespace string\nis a separator.  Maxsplit defaults to 0.\n\n(split and splitfields are synonymous)'
    pass

def strip(s):
    'strip(s) -> string\n\nReturn a copy of the string s with leading and trailing\nwhitespace removed.'
    pass

def swapcase(s):
    'swapcase(s) -> string\n\nReturn a copy of the string s with upper case characters\nconverted to lowercase and vice versa.'
    pass

def translate(s, table, deletechars):
    'translate(s,table [,deletechars]) -> string\n\nReturn a copy of the string s, where all characters occurring\nin the optional argument deletechars are removed, and the\nremaining characters have been mapped through the given\ntranslation table, which must be a string of length 256.'
    pass

def upper(s):
    'upper(s) -> string\n\nReturn a copy of the string s converted to uppercase.'
    pass

uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
whitespace = '\t\n\x0b\x0c\r '
