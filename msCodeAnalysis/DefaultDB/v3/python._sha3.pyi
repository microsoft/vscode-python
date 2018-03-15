import builtins

__doc__ = None
__name__ = '_sha3'
__package__ = ''
implementation = 'generic 64-bit optimized implementation (lane complementing, all rounds unrolled)'
keccakopt = 64
class sha3_224(builtins.object):
    'Return a new SHA3 hash object with a hashbit length of 28 bytes.'
    __class__ = sha3_224
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def _capacity_bits(self):
        pass
    
    @property
    def _rate_bits(self):
        pass
    
    @property
    def _suffix(self):
        pass
    
    @property
    def block_size(self):
        pass
    
    def copy(self):
        'Return a copy of the hash object.'
        pass
    
    def digest(self):
        'Return the digest value as a string of binary data.'
        pass
    
    @property
    def digest_size(self):
        pass
    
    def hexdigest(self):
        'Return the digest value as a string of hexadecimal digits.'
        pass
    
    @property
    def name(self):
        pass
    
    def update(self, obj):
        "Update this hash object's state with the provided string."
        pass
    

class sha3_256(builtins.object):
    'sha3_256([string]) -> SHA3 object\n\nReturn a new SHA3 hash object with a hashbit length of 32 bytes.'
    __class__ = sha3_256
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def _capacity_bits(self):
        pass
    
    @property
    def _rate_bits(self):
        pass
    
    @property
    def _suffix(self):
        pass
    
    @property
    def block_size(self):
        pass
    
    def copy(self):
        'Return a copy of the hash object.'
        pass
    
    def digest(self):
        'Return the digest value as a string of binary data.'
        pass
    
    @property
    def digest_size(self):
        pass
    
    def hexdigest(self):
        'Return the digest value as a string of hexadecimal digits.'
        pass
    
    @property
    def name(self):
        pass
    
    def update(self, obj):
        "Update this hash object's state with the provided string."
        pass
    

class sha3_384(builtins.object):
    'sha3_384([string]) -> SHA3 object\n\nReturn a new SHA3 hash object with a hashbit length of 48 bytes.'
    __class__ = sha3_384
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def _capacity_bits(self):
        pass
    
    @property
    def _rate_bits(self):
        pass
    
    @property
    def _suffix(self):
        pass
    
    @property
    def block_size(self):
        pass
    
    def copy(self):
        'Return a copy of the hash object.'
        pass
    
    def digest(self):
        'Return the digest value as a string of binary data.'
        pass
    
    @property
    def digest_size(self):
        pass
    
    def hexdigest(self):
        'Return the digest value as a string of hexadecimal digits.'
        pass
    
    @property
    def name(self):
        pass
    
    def update(self, obj):
        "Update this hash object's state with the provided string."
        pass
    

class sha3_512(builtins.object):
    'sha3_512([string]) -> SHA3 object\n\nReturn a new SHA3 hash object with a hashbit length of 64 bytes.'
    __class__ = sha3_512
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def _capacity_bits(self):
        pass
    
    @property
    def _rate_bits(self):
        pass
    
    @property
    def _suffix(self):
        pass
    
    @property
    def block_size(self):
        pass
    
    def copy(self):
        'Return a copy of the hash object.'
        pass
    
    def digest(self):
        'Return the digest value as a string of binary data.'
        pass
    
    @property
    def digest_size(self):
        pass
    
    def hexdigest(self):
        'Return the digest value as a string of hexadecimal digits.'
        pass
    
    @property
    def name(self):
        pass
    
    def update(self, obj):
        "Update this hash object's state with the provided string."
        pass
    

class shake_128(builtins.object):
    'shake_128([string]) -> SHAKE object\n\nReturn a new SHAKE hash object.'
    __class__ = shake_128
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def _capacity_bits(self):
        pass
    
    @property
    def _rate_bits(self):
        pass
    
    @property
    def _suffix(self):
        pass
    
    @property
    def block_size(self):
        pass
    
    def copy(self):
        'Return a copy of the hash object.'
        pass
    
    def digest(self, length):
        'Return the digest value as a string of binary data.'
        pass
    
    @property
    def digest_size(self):
        pass
    
    def hexdigest(self, length):
        'Return the digest value as a string of hexadecimal digits.'
        pass
    
    @property
    def name(self):
        pass
    
    def update(self, obj):
        "Update this hash object's state with the provided string."
        pass
    

class shake_256(builtins.object):
    'shake_256([string]) -> SHAKE object\n\nReturn a new SHAKE hash object.'
    __class__ = shake_256
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def _capacity_bits(self):
        pass
    
    @property
    def _rate_bits(self):
        pass
    
    @property
    def _suffix(self):
        pass
    
    @property
    def block_size(self):
        pass
    
    def copy(self):
        'Return a copy of the hash object.'
        pass
    
    def digest(self, length):
        'Return the digest value as a string of binary data.'
        pass
    
    @property
    def digest_size(self):
        pass
    
    def hexdigest(self, length):
        'Return the digest value as a string of hexadecimal digits.'
        pass
    
    @property
    def name(self):
        pass
    
    def update(self, obj):
        "Update this hash object's state with the provided string."
        pass
    

