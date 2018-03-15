import exceptions

DEFLATED = 8
DEF_MEM_LEVEL = 8
MAX_WBITS = 15
ZLIB_VERSION = '1.2.11'
Z_BEST_COMPRESSION = 9
Z_BEST_SPEED = 1
Z_DEFAULT_COMPRESSION = -1
Z_DEFAULT_STRATEGY = 0
Z_FILTERED = 1
Z_FINISH = 4
Z_FULL_FLUSH = 3
Z_HUFFMAN_ONLY = 2
Z_NO_FLUSH = 0
Z_SYNC_FLUSH = 2
__doc__ = "The functions in this module allow compression and decompression using the\nzlib library, which is based on GNU zip.\n\nadler32(string[, start]) -- Compute an Adler-32 checksum.\ncompress(string[, level]) -- Compress string, with compression level in 0-9.\ncompressobj([level]) -- Return a compressor object.\ncrc32(string[, start]) -- Compute a CRC-32 checksum.\ndecompress(string,[wbits],[bufsize]) -- Decompresses a compressed string.\ndecompressobj([wbits]) -- Return a decompressor object.\n\n'wbits' is window buffer size and container format.\nCompressor objects support compress() and flush() methods; decompressor\nobjects support decompress() and flush()."
__name__ = 'zlib'
__package__ = None
__version__ = '1.0'
def adler32(string, start):
    'adler32(string[, start]) -- Compute an Adler-32 checksum of string.\n\nAn optional starting value can be specified.  The returned checksum is\na signed integer.'
    pass

def compress(string, level):
    'compress(string[, level]) -- Returned compressed string.\n\nOptional arg level is the compression level, in 0-9.'
    pass

def compressobj(level):
    'compressobj([level]) -- Return a compressor object.\n\nOptional arg level is the compression level, in 0-9 or -1.'
    pass

def crc32(string, start):
    'crc32(string[, start]) -- Compute a CRC-32 checksum of string.\n\nAn optional starting value can be specified.  The returned checksum is\na signed integer.'
    pass

def decompress(string, wbits, bufsize):
    'decompress(string[, wbits[, bufsize]]) -- Return decompressed string.\n\nOptional arg wbits indicates the window buffer size and container format.\nOptional arg bufsize is the initial output buffer size.'
    pass

def decompressobj(wbits):
    'decompressobj([wbits]) -- Return a decompressor object.\n\nOptional arg wbits indicates the window buffer size and container format.'
    pass

class error(exceptions.Exception):
    __class__ = error
    __dict__ = __builtin__.dict()
    __module__ = 'zlib'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

