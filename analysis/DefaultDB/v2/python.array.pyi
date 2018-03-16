import __builtin__

ArrayType = array()
__doc__ = "This module defines an object type which can efficiently represent\nan array of basic values: characters, integers, floating point\nnumbers.  Arrays are sequence types and behave very much like lists,\nexcept that the type of objects stored in them is constrained.  The\ntype is specified at object creation time by using a type code, which\nis a single character.  The following type codes are defined:\n\n    Type code   C Type             Minimum size in bytes \n    'c'         character          1 \n    'b'         signed integer     1 \n    'B'         unsigned integer   1 \n    'u'         Unicode character  2 \n    'h'         signed integer     2 \n    'H'         unsigned integer   2 \n    'i'         signed integer     2 \n    'I'         unsigned integer   2 \n    'l'         signed integer     4 \n    'L'         unsigned integer   4 \n    'f'         floating point     4 \n    'd'         floating point     8 \n\nThe constructor is:\n\narray(typecode [, initializer]) -- create a new array\n"
__name__ = 'array'
__package__ = None
class array(__builtin__.object):
    'array(typecode [, initializer]) -> array\n\nReturn a new array whose items are restricted by typecode, and\ninitialized from the optional initializer value, which must be a list,\nstring or iterable over elements of the appropriate type.\n\nArrays represent basic values and behave very much like lists, except\nthe type of objects stored in them is constrained.\n\nMethods:\n\nappend() -- append a new item to the end of the array\nbuffer_info() -- return information giving the current memory info\nbyteswap() -- byteswap all the items of the array\ncount() -- return number of occurrences of an object\nextend() -- extend array by appending multiple elements from an iterable\nfromfile() -- read items from a file object\nfromlist() -- append items from the list\nfromstring() -- append items from the string\nindex() -- return index of first occurrence of an object\ninsert() -- insert a new item into the array at a provided position\npop() -- remove and return item (default last)\nread() -- DEPRECATED, use fromfile()\nremove() -- remove first occurrence of an object\nreverse() -- reverse the order of the items in the array\ntofile() -- write all items to a file object\ntolist() -- return the array converted to an ordinary list\ntostring() -- return the array converted to a string\nwrite() -- DEPRECATED, use tofile()\n\nAttributes:\n\ntypecode -- the typecode character used to create the array\nitemsize -- the length in bytes of one array item\n'
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return array()
    
    __class__ = array
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    def __copy__(self):
        'copy(array)\n\n Return a copy of the array.'
        pass
    
    def __deepcopy__(self):
        'copy(array)\n\n Return a copy of the array.'
        pass
    
    def __delitem__(self, y):
        'x.__delitem__(y) <==> del x[y]'
        return None
    
    def __delslice__(self, i, j):
        'x.__delslice__(i, j) <==> del x[i:j]\n           \n           Use of negative indices is not supported.'
        pass
    
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return array()
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __iadd__(self, y):
        'x.__iadd__(y) <==> x+=y'
        return None
    
    def __imul__(self, y):
        'x.__imul__(y) <==> x*=y'
        return None
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return array()
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return array()
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __reduce__(self):
        'Return state information for pickling.'
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return array()
    
    def __setitem__(self, index, value):
        'x.__setitem__(i, y) <==> x[i]=y'
        return None
    
    def __setslice__(self, i, j, y):
        'x.__setslice__(i, j, y) <==> x[i:j]=y\n           \n           Use  of negative indices is not supported.'
        pass
    
    def __sizeof__(self):
        '__sizeof__() -> int\n\nSize of the array in memory, in bytes.'
        return 0
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def append(self, x):
        'append(x)\n\nAppend new value x to the end of the array.'
        pass
    
    def buffer_info(self):
        "buffer_info() -> (address, length)\n\nReturn a tuple (address, length) giving the current memory address and\nthe length in items of the buffer used to hold array's contents\nThe length should be multiplied by the itemsize attribute to calculate\nthe buffer length in bytes."
        pass
    
    def byteswap(self):
        'byteswap()\n\nByteswap all items of the array.  If the items in the array are not 1, 2,\n4, or 8 bytes in size, RuntimeError is raised.'
        pass
    
    def count(self, x):
        'count(x)\n\nReturn number of occurrences of x in the array.'
        pass
    
    def extend(self):
        'extend(array or iterable)\n\n Append items to the end of the array.'
        pass
    
    def fromfile(self, f, n):
        'fromfile(f, n)\n\nRead n objects from the file object f and append them to the end of the\narray.  Also called as read.'
        pass
    
    def fromlist(self, list):
        'fromlist(list)\n\nAppend items to array from list.'
        pass
    
    def fromstring(self, string):
        'fromstring(string)\n\nAppends items from the string, interpreting it as an array of machine\nvalues,as if it had been read from a file using the fromfile() method).'
        pass
    
    def fromunicode(self, ustr):
        "fromunicode(ustr)\n\nExtends this array with data from the unicode string ustr.\nThe array must be a type 'u' array; otherwise a ValueError\nis raised.  Use array.fromstring(ustr.decode(...)) to\nappend Unicode data to an array of some other type."
        pass
    
    def index(self, x):
        'index(x)\n\nReturn index of first occurrence of x in the array.'
        pass
    
    def insert(self, i, x):
        'insert(i,x)\n\nInsert a new item x into the array before position i.'
        pass
    
    @property
    def itemsize(self):
        'the size, in bytes, of one array item'
        pass
    
    def pop(self, i):
        'pop([i])\n\nReturn the i-th element and delete it from the array. i defaults to -1.'
        pass
    
    def read(self):
        'fromfile(f, n)\n\nRead n objects from the file object f and append them to the end of the\narray.  Also called as read.'
        pass
    
    def remove(self, x):
        'remove(x)\n\nRemove the first occurrence of x in the array.'
        pass
    
    def reverse(self):
        'reverse()\n\nReverse the order of the items in the array.'
        pass
    
    def tofile(self, f):
        'tofile(f)\n\nWrite all items (as machine values) to the file object f.  Also called as\nwrite.'
        pass
    
    def tolist(self):
        'tolist() -> list\n\nConvert array to an ordinary list with the same items.'
        pass
    
    def tostring(self):
        'tostring() -> string\n\nConvert the array to an array of machine values and return the string\nrepresentation.'
        pass
    
    def tounicode(self):
        "tounicode() -> unicode\n\nConvert the array to a unicode string.  The array must be\na type 'u' array; otherwise a ValueError is raised.  Use\narray.tostring().decode() to obtain a unicode string from\nan array of some other type."
        pass
    
    @property
    def typecode(self):
        'the typecode character used to create the array'
        pass
    
    def write(self):
        'tofile(f)\n\nWrite all items (as machine values) to the file object f.  Also called as\nwrite.'
        pass
    

