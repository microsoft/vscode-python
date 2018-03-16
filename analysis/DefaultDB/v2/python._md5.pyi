import __builtin__

md5 = __builtin__.type
MD5Type = md5()
__doc__ = "This module implements the interface to RSA's MD5 message digest\nalgorithm (see also Internet RFC 1321). Its use is quite\nstraightforward: use the new() to create an md5 object. You can now\nfeed this object with arbitrary strings using the update() method, and\nat any point you can ask it for the digest (a strong kind of 128-bit\nchecksum, a.k.a. ``fingerprint'') of the concatenation of the strings\nfed to it so far using the digest() method.\n\nFunctions:\n\nnew([arg]) -- return a new md5 object, initialized with arg if provided\nmd5([arg]) -- DEPRECATED, same as new, but for compatibility\n\nSpecial Objects:\n\nMD5Type -- type object for md5 objects"
__name__ = '_md5'
__package__ = None
digest_size = 16
def new(arg):
    'new([arg]) -> md5 object\n\nReturn a new md5 object. If arg is present, the method call update(arg)\nis made.'
    pass

