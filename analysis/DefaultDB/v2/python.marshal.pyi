__doc__ = 'This module contains functions that can read and write Python values in\na binary format. The format is specific to Python, but independent of\nmachine architecture issues.\n\nNot all Python object types are supported; in general, only objects\nwhose value is independent from a particular invocation of Python can be\nwritten and read by this module. The following types are supported:\nNone, integers, long integers, floating point numbers, strings, Unicode\nobjects, tuples, lists, sets, dictionaries, and code objects, where it\nshould be understood that tuples, lists and dictionaries are only\nsupported as long as the values contained therein are themselves\nsupported; and recursive lists and dictionaries should not be written\n(they will cause infinite loops).\n\nVariables:\n\nversion -- indicates the format that the module uses. Version 0 is the\n    historical format, version 1 (added in Python 2.4) shares interned\n    strings and version 2 (added in Python 2.5) uses a binary format for\n    floating point numbers. (New in version 2.4)\n\nFunctions:\n\ndump() -- write value to a file\nload() -- read value from a file\ndumps() -- write value to a string\nloads() -- read value from a string'
__name__ = 'marshal'
__package__ = None
def dump(value, file, version):
    "dump(value, file[, version])\n\nWrite the value on the open file. The value must be a supported type.\nThe file must be an open file object such as sys.stdout or returned by\nopen() or os.popen(). It must be opened in binary mode ('wb' or 'w+b').\n\nIf the value has (or contains an object that has) an unsupported type, a\nValueError exception is raised \xe2\x80\x94 but garbage data will also be written\nto the file. The object will not be properly read back by load()\n\nNew in version 2.4: The version argument indicates the data format that\ndump should use."
    pass

def dumps(value, version):
    'dumps(value[, version])\n\nReturn the string that would be written to a file by dump(value, file).\nThe value must be a supported type. Raise a ValueError exception if\nvalue has (or contains an object that has) an unsupported type.\n\nNew in version 2.4: The version argument indicates the data format that\ndumps should use.'
    pass

def load(file):
    "load(file)\n\nRead one value from the open file and return it. If no valid value is\nread (e.g. because the data has a different Python version\xe2\x80\x99s\nincompatible marshal format), raise EOFError, ValueError or TypeError.\nThe file must be an open file object opened in binary mode ('rb' or\n'r+b').\n\nNote: If an object containing an unsupported type was marshalled with\ndump(), load() will substitute None for the unmarshallable type."
    pass

def loads(string):
    'loads(string)\n\nConvert the string to a value. If no valid value is found, raise\nEOFError, ValueError or TypeError. Extra characters in the string are\nignored.'
    pass

version = 2
