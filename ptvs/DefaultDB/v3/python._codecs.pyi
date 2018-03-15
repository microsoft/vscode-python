__doc__ = None
__name__ = '_codecs'
__package__ = ''
def _forget_codec(encoding):
    'Purge the named codec from the internal codec lookup cache'
    pass

def ascii_decode(data, errors):
    pass

def ascii_encode(str, errors):
    pass

def charmap_build(map):
    pass

def charmap_decode(data, errors, mapping):
    pass

def charmap_encode(str, errors, mapping):
    pass

def code_page_decode(codepage, data, errors, final):
    pass

def code_page_encode(code_page, str, errors):
    pass

def decode(obj, encoding, errors):
    "Decodes obj using the codec registered for encoding.\n\nDefault encoding is 'utf-8'.  errors may be given to set a\ndifferent error handling scheme.  Default is 'strict' meaning that encoding\nerrors raise a ValueError.  Other possible values are 'ignore', 'replace'\nand 'backslashreplace' as well as any other name registered with\ncodecs.register_error that can handle ValueErrors."
    pass

def encode(obj, encoding, errors):
    "Encodes obj using the codec registered for encoding.\n\nThe default encoding is 'utf-8'.  errors may be given to set a\ndifferent error handling scheme.  Default is 'strict' meaning that encoding\nerrors raise a ValueError.  Other possible values are 'ignore', 'replace'\nand 'backslashreplace' as well as any other name registered with\ncodecs.register_error that can handle ValueErrors."
    pass

def escape_decode(data, errors):
    pass

def escape_encode(data, errors):
    pass

def latin_1_decode(data, errors):
    pass

def latin_1_encode(str, errors):
    pass

def lookup(encoding):
    'Looks up a codec tuple in the Python codec registry and returns a CodecInfo object.'
    pass

def lookup_error(name):
    'lookup_error(errors) -> handler\n\nReturn the error handler for the specified error handling name or raise a\nLookupError, if no handler exists under this name.'
    pass

def mbcs_decode(data, errors, final):
    pass

def mbcs_encode(str, errors):
    pass

def oem_decode(data, errors, final):
    pass

def oem_encode(str, errors):
    pass

def raw_unicode_escape_decode(data, errors):
    pass

def raw_unicode_escape_encode(str, errors):
    pass

def readbuffer_encode(data, errors):
    pass

def register(search_function):
    'Register a codec search function.\n\nSearch functions are expected to take one argument, the encoding name in\nall lower case letters, and either return None, or a tuple of functions\n(encoder, decoder, stream_reader, stream_writer) (or a CodecInfo object).'
    pass

def register_error(errors, handler):
    'Register the specified error handler under the name errors.\n\nhandler must be a callable object, that will be called with an exception\ninstance containing information about the location of the encoding/decoding\nerror and must return a (replacement, new position) tuple.'
    pass

def unicode_escape_decode(data, errors):
    pass

def unicode_escape_encode(str, errors):
    pass

def unicode_internal_decode(obj, errors):
    pass

def unicode_internal_encode(obj, errors):
    pass

def utf_16_be_decode(data, errors, final):
    pass

def utf_16_be_encode(str, errors):
    pass

def utf_16_decode(data, errors, final):
    pass

def utf_16_encode(str, errors, byteorder):
    pass

def utf_16_ex_decode(data, errors, byteorder, final):
    pass

def utf_16_le_decode(data, errors, final):
    pass

def utf_16_le_encode(str, errors):
    pass

def utf_32_be_decode(data, errors, final):
    pass

def utf_32_be_encode(str, errors):
    pass

def utf_32_decode(data, errors, final):
    pass

def utf_32_encode(str, errors, byteorder):
    pass

def utf_32_ex_decode(data, errors, byteorder, final):
    pass

def utf_32_le_decode(data, errors, final):
    pass

def utf_32_le_encode(str, errors):
    pass

def utf_7_decode(data, errors, final):
    pass

def utf_7_encode(str, errors):
    pass

def utf_8_decode(data, errors, final):
    pass

def utf_8_encode(str, errors):
    pass

