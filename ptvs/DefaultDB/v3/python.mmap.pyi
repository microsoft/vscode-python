import builtins

ACCESS_COPY = 3
ACCESS_READ = 1
ACCESS_WRITE = 2
ALLOCATIONGRANULARITY = 65536
PAGESIZE = 4096
__doc__ = None
__name__ = 'mmap'
__package__ = ''
error = builtins.OSError
class mmap(builtins.object):
    "Windows: mmap(fileno, length[, tagname[, access[, offset]]])\n\nMaps length bytes from the file specified by the file handle fileno,\nand returns a mmap object.  If length is larger than the current size\nof the file, the file is extended to contain length bytes.  If length\nis 0, the maximum length of the map is the current size of the file,\nexcept that if the file is empty Windows raises an exception (you cannot\ncreate an empty mapping on Windows).\n\nUnix: mmap(fileno, length[, flags[, prot[, access[, offset]]]])\n\nMaps length bytes from the file specified by the file descriptor fileno,\nand returns a mmap object.  If length is 0, the maximum length of the map\nwill be the current size of the file when mmap is called.\nflags specifies the nature of the mapping. MAP_PRIVATE creates a\nprivate copy-on-write mapping, so changes to the contents of the mmap\nobject will be private to this process, and MAP_SHARED creates a mapping\nthat's shared with all other processes mapping the same areas of the file.\nThe default value is MAP_SHARED.\n\nTo map anonymous memory, pass -1 as the fileno (both versions)."
    def __add__(self, value):
        'Return self+value.'
        pass
    
    __class__ = mmap
    def __delitem__(self, key):
        'Delete self[key].'
        pass
    
    def __enter__(self):
        pass
    
    def __exit__(self):
        pass
    
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    def __getitem__(self, key):
        'Return self[key].'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __len__(self):
        'Return len(self).'
        pass
    
    def __mul__(self, value):
        'Return self*value.n'
        pass
    
    def __rmul__(self, value):
        'Return self*value.'
        pass
    
    def __setitem__(self, key, value):
        'Set self[key] to value.'
        pass
    
    def __sizeof__(self):
        return 0
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        pass
    
    @property
    def closed(self):
        pass
    
    def find(self):
        pass
    
    def flush(self):
        pass
    
    def move(self):
        pass
    
    def read(self):
        pass
    
    def read_byte(self):
        pass
    
    def readline(self):
        pass
    
    def resize(self):
        pass
    
    def rfind(self):
        pass
    
    def seek(self):
        pass
    
    def size(self):
        pass
    
    def tell(self):
        pass
    
    def write(self):
        pass
    
    def write_byte(self):
        pass
    

