import exceptions

class Error(exceptions.Exception):
    __class__ = Error
    __dict__ = __builtin__.dict()
    __module__ = 'binascii'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

class Incomplete(exceptions.Exception):
    __class__ = Incomplete
    __dict__ = __builtin__.dict()
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
__package__ = None
def a2b_base64():
    '(ascii) -> bin. Decode a line of base64 data'
    pass

def a2b_hex(hexstr):
    'a2b_hex(hexstr) -> s; Binary data of hexadecimal representation.\n\nhexstr must contain an even number of hex digits (upper or lower case).\nThis function is also available as "unhexlify()"'
    pass

def a2b_hqx():
    'ascii -> bin, done. Decode .hqx coding'
    pass

def a2b_qp():
    'Decode a string of qp-encoded data'
    pass

def a2b_uu():
    '(ascii) -> bin. Decode a line of uuencoded data'
    pass

def b2a_base64():
    '(bin) -> ascii. Base64-code line of data'
    pass

def b2a_hex(data):
    'b2a_hex(data) -> s; Hexadecimal representation of binary data.\n\nThis function is also available as "hexlify()".'
    pass

def b2a_hqx():
    'Encode .hqx data'
    pass

def b2a_qp(data, quotetabs=0, istext=1, header=0):
    'b2a_qp(data, quotetabs=0, istext=1, header=0) -> s; \n Encode a string using quoted-printable encoding. \n\nOn encoding, when istext is set, newlines are not encoded, and white \nspace at end of lines is.  When istext is not set, \\r and \\n (CR/LF) are \nboth encoded.  When quotetabs is set, space and tabs are encoded.'
    pass

def b2a_uu():
    '(bin) -> ascii. Uuencode line of data'
    pass

def crc32():
    '(data, oldcrc = 0) -> newcrc. Compute CRC-32 incrementally'
    pass

def crc_hqx():
    '(data, oldcrc) -> newcrc. Compute CRC-CCITT incrementally'
    pass

def hexlify():
    'b2a_hex(data) -> s; Hexadecimal representation of binary data.\n\nThis function is also available as "hexlify()".'
    pass

def rlecode_hqx():
    'Binhex RLE-code binary data'
    pass

def rledecode_hqx():
    'Decode hexbin RLE-coded string'
    pass

def unhexlify():
    'a2b_hex(hexstr) -> s; Binary data of hexadecimal representation.\n\nhexstr must contain an even number of hex digits (upper or lower case).\nThis function is also available as "unhexlify()"'
    pass

