import builtins

class Error(builtins.ValueError):
    __class__ = Error
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'binascii'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class Incomplete(builtins.Exception):
    __class__ = Incomplete
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'binascii'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

__doc__ = 'Conversion between binary data and ASCII'
__name__ = 'binascii'
__package__ = ''
def a2b_base64(data):
    'Decode a line of base64 data.'
    pass

def a2b_hex(hexstr):
    'Binary data of hexadecimal representation.\n\nhexstr must contain an even number of hex digits (upper or lower case).\nThis function is also available as "unhexlify()".'
    pass

def a2b_hqx(data):
    'Decode .hqx coding.'
    pass

def a2b_qp(data, header):
    'Decode a string of qp-encoded data.'
    pass

def a2b_uu(data):
    'Decode a line of uuencoded data.'
    pass

def b2a_base64(data):
    'Base64-code line of data.'
    pass

def b2a_hex(data):
    'Hexadecimal representation of binary data.\n\nThe return value is a bytes object.  This function is also\navailable as "hexlify()".'
    pass

def b2a_hqx(data):
    'Encode .hqx data.'
    pass

def b2a_qp(data, quotetabs, istext, header):
    'Encode a string using quoted-printable encoding.\n\nOn encoding, when istext is set, newlines are not encoded, and white\nspace at end of lines is.  When istext is not set, \\r and \\n (CR/LF)\nare both encoded.  When quotetabs is set, space and tabs are encoded.'
    pass

def b2a_uu(data):
    'Uuencode line of data.'
    pass

def crc32(data, crc):
    'Compute CRC-32 incrementally.'
    pass

def crc_hqx(data, crc):
    'Compute CRC-CCITT incrementally.'
    pass

def hexlify(data):
    'Hexadecimal representation of binary data.\n\nThe return value is a bytes object.'
    pass

def rlecode_hqx(data):
    'Binhex RLE-code binary data.'
    pass

def rledecode_hqx(data):
    'Decode hexbin RLE-coded string.'
    pass

def unhexlify(hexstr):
    'Binary data of hexadecimal representation.\n\nhexstr must contain an even number of hex digits (upper or lower case).'
    pass

