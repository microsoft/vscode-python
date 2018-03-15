import builtins

ArrayType = array()
__doc__ = 'This module defines an object type which can efficiently represent\nan array of basic values: characters, integers, floating point\nnumbers.  Arrays are sequence types and behave very much like lists,\nexcept that the type of objects stored in them is constrained.\n'
__name__ = 'array'
__package__ = ''
def _array_reconstructor(arraytype, typecode, mformat_code, items):
    'Internal. Used for pickling support.'
    pass

class array(builtins.object):
    "array(typecode [, initializer]) -> array\n\nReturn a new array whose items are restricted by typecode, and\ninitialized from the optional initializer value, which must be a list,\nstring or iterable over elements of the appropriate type.\n\nArrays represent basic values and behave very much like lists, except\nthe type of objects stored in them is constrained. The type is specified\nat object creation time by using a type code, which is a single character.\nThe following type codes are defined:\n\n    Type code   C Type             Minimum size in bytes \n    'b'         signed integer     1 \n    'B'         unsigned integer   1 \n    'u'         Unicode character  2 (see note) \n    'h'         signed integer     2 \n    'H'         unsigned integer   2 \n    'i'         signed integer     2 \n    'I'         unsigned integer   2 \n    'l'         signed integer     4 \n    'L'         unsigned integer   4 \n    'q'         signed integer     8 (see note) \n    'Q'         unsigned integer   8 (see note) \n    'f'         floating point     4 \n    'd'         floating point     8 \n\nNOTE: The 'u' typecode corresponds to Python's unicode character. On \nnarrow builds this is 2-bytes on wide builds this is 4-bytes.\n\nNOTE: The 'q' and 'Q' type codes are only available if the platform \nC compiler used to build Python supports 'long long', or, on Windows, \n'__int64'.\n\nMethods:\n\nappend() -- append a new item to the end of the array\nbuffer_info() -- return information giving the current memory info\nbyteswap() -- byteswap all the items of the array\ncount() -- return number of occurrences of an object\nextend() -- extend array by appending multiple elements from an iterable\nfromfile() -- read items from a file object\nfromlist() -- append items from the list\nfrombytes() -- append items from the string\nindex() -- return index of first occurrence of an object\ninsert() -- insert a new item into the array at a provided position\npop() -- remove and return item (default last)\nremove() -- remove first occurrence of an object\nreverse() -- reverse the order of the items in the array\ntofile() -- write all items to a file object\ntolist() -- return the array converted to an ordinary list\ntobytes() -- return the array converted to a string\n\nAttributes:\n\ntypecode -- the typecode character used to create the array\nitemsize -- the length in bytes of one array item\n"
    def __add__(self, value):
        'Return self+value.'
        pass
    
    __class__ = array
    def __contains__(self, key):
        'Return key in self.'
        pass
    
    def __copy__(self):
        'Return a copy of the array.'
        pass
    
    def __deepcopy__(self, unused):
        'Return a copy of the array.'
        pass
    
    def __delitem__(self, key):
        'Delete self[key].'
        pass
    
    def __eq__(self, value):
        'Return self==value.'
        pass
    
    def __ge__(self, value):
        'Return self>=value.'
        pass
    
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    def __getitem__(self, key):
        'Return self[key].'
        pass
    
    def __gt__(self, value):
        'Return self>value.'
        pass
    
    __hash__ = None
    def __iadd__(self, value):
        'Implement self+=value.'
        pass
    
    def __imul__(self, value):
        'Implement self*=value.'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __iter__(self):
        'Implement iter(self).'
        pass
    
    def __le__(self, value):
        'Return self<=value.'
        pass
    
    def __len__(self):
        'Return len(self).'
        pass
    
    def __lt__(self, value):
        'Return self<value.'
        pass
    
    def __mul__(self, value):
        'Return self*value.n'
        pass
    
    def __ne__(self, value):
        'Return self!=value.'
        pass
    
    def __reduce_ex__(self, value):
        'Return state information for pickling.'
        pass
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    def __rmul__(self, value):
        'Return self*value.'
        pass
    
    def __setitem__(self, key, value):
        'Set self[key] to value.'
        pass
    
    def __sizeof__(self):
        'Size of the array in memory, in bytes.'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def append(self, v):
        'Append new value v to the end of the array.'
        pass
    
    def buffer_info(self):
        "Return a tuple (address, length) giving the current memory address and the length in items of the buffer used to hold array's contents.\n\nThe length should be multiplied by the itemsize attribute to calculate\nthe buffer length in bytes."
        pass
    
    def byteswap(self):
        'Byteswap all items of the array.\n\nIf the items in the array are not 1, 2, 4, or 8 bytes in size, RuntimeError is\nraised.'
        pass
    
    def count(self, v):
        'Return number of occurrences of v in the array.'
        pass
    
    def extend(self, bb):
        'Append items to the end of the array.'
        pass
    
    def frombytes(self, buffer):
        'Appends items from the string, interpreting it as an array of machine values, as if it had been read from a file using the fromfile() method).'
        pass
    
    def fromfile(self, f, n):
        'Read n objects from the file object f and append them to the end of the array.'
        pass
    
    def fromlist(self, list):
        'Append items to array from list.'
        pass
    
    def fromstring(self, buffer):
        'Appends items from the string, interpreting it as an array of machine values, as if it had been read from a file using the fromfile() method).\n\nThis method is deprecated. Use frombytes instead.'
        pass
    
    def fromunicode(self, ustr):
        'Extends this array with data from the unicode string ustr.\n\nThe array must be a unicode type array; otherwise a ValueError is raised.\nUse array.frombytes(ustr.encode(...)) to append Unicode data to an array of\nsome other type.'
        pass
    
    def index(self, v):
        'Return index of first occurrence of v in the array.'
        pass
    
    def insert(self, i, v):
        'Insert a new item v into the array before position i.'
        pass
    
    @property
    def itemsize(self):
        'the size, in bytes, of one array item'
        pass
    
    def pop(self, i):
        'Return the i-th element and delete it from the array.\n\ni defaults to -1.'
        pass
    
    def remove(self, v):
        'Remove the first occurrence of v in the array.'
        pass
    
    def reverse(self):
        'Reverse the order of the items in the array.'
        pass
    
    def tobytes(self):
        'Convert the array to an array of machine values and return the bytes representation.'
        pass
    
    def tofile(self, f):
        'Write all items (as machine values) to the file object f.'
        pass
    
    def tolist(self):
        'Convert array to an ordinary list with the same items.'
        pass
    
    def tostring(self):
        'Convert the array to an array of machine values and return the bytes representation.\n\nThis method is deprecated. Use tobytes instead.'
        pass
    
    def tounicode(self):
        'Extends this array with data from the unicode string ustr.\n\nConvert the array to a unicode string.  The array must be a unicode type array;\notherwise a ValueError is raised.  Use array.tobytes().decode() to obtain a\nunicode string from an array of some other type.'
        pass
    
    @property
    def typecode(self):
        'the typecode character used to create the array'
        pass
    

typecodes = 'bBuhHiIlLqQfd'
