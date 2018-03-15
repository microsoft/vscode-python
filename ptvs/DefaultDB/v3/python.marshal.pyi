__doc__ = 'This module contains functions that can read and write Python values in\na binary format. The format is specific to Python, but independent of\nmachine architecture issues.\n\nNot all Python object types are supported; in general, only objects\nwhose value is independent from a particular invocation of Python can be\nwritten and read by this module. The following types are supported:\nNone, integers, floating point numbers, strings, bytes, bytearrays,\ntuples, lists, sets, dictionaries, and code objects, where it\nshould be understood that tuples, lists and dictionaries are only\nsupported as long as the values contained therein are themselves\nsupported; and recursive lists and dictionaries should not be written\n(they will cause infinite loops).\n\nVariables:\n\nversion -- indicates the format that the module uses. Version 0 is the\n    historical format, version 1 shares interned strings and version 2\n    uses a binary format for floating point numbers.\n    Version 3 shares common object references (New in version 3.4).\n\nFunctions:\n\ndump() -- write value to a file\nload() -- read value from a file\ndumps() -- marshal value as a bytes object\nloads() -- read value from a bytes-like object'
__name__ = 'marshal'
__package__ = ''
def dump(value, file, version):
    'dump(value, file[, version])\n\nWrite the value on the open file. The value must be a supported type.\nThe file must be a writeable binary file.\n\nIf the value has (or contains an object that has) an unsupported type, a\nValueError exception is raised - but garbage data will also be written\nto the file. The object will not be properly read back by load()\n\nThe version argument indicates the data format that dump should use.'
    pass

def dumps(value, version):
    'dumps(value[, version])\n\nReturn the bytes object that would be written to a file by dump(value, file).\nThe value must be a supported type. Raise a ValueError exception if\nvalue has (or contains an object that has) an unsupported type.\n\nThe version argument indicates the data format that dumps should use.'
    pass

def load(file):
    "load(file)\n\nRead one value from the open file and return it. If no valid value is\nread (e.g. because the data has a different Python version's\nincompatible marshal format), raise EOFError, ValueError or TypeError.\nThe file must be a readable binary file.\n\nNote: If an object containing an unsupported type was marshalled with\ndump(), load() will substitute None for the unmarshallable type."
    pass

def loads(bytes):
    'loads(bytes)\n\nConvert the bytes-like object to a value. If no valid value is found,\nraise EOFError, ValueError or TypeError. Extra bytes in the input are\nignored.'
    pass

version = 4
