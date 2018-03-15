import builtins

__doc__ = 'This module is always available. It provides access to mathematical\nfunctions for complex numbers.'
__name__ = 'cmath'
__package__ = ''
def acos(z):
    'Return the arc cosine of z.'
    pass

def acosh(z):
    'Return the inverse hyperbolic cosine of z.'
    pass

def asin(z):
    'Return the arc sine of z.'
    pass

def asinh(z):
    'Return the inverse hyperbolic sine of z.'
    pass

def atan(z):
    'Return the arc tangent of z.'
    pass

def atanh(z):
    'Return the inverse hyperbolic tangent of z.'
    pass

def cos(z):
    'Return the cosine of z.'
    pass

def cosh(z):
    'Return the hyperbolic cosine of z.'
    pass

e = 2.718281828459045
def exp(z):
    'Return the exponential value e**z.'
    pass

inf = float('inf')
infj = builtins.complex()
def isclose(a, b):
    'Determine whether two complex numbers are close in value.\n\n  rel_tol\n    maximum difference for being considered "close", relative to the\n    magnitude of the input values\n  abs_tol\n    maximum difference for being considered "close", regardless of the\n    magnitude of the input values\n\nReturn True if a is close in value to b, and False otherwise.\n\nFor the values to be considered close, the difference between them must be\nsmaller than at least one of the tolerances.\n\n-inf, inf and NaN behave similarly to the IEEE 754 Standard. That is, NaN is\nnot close to anything, even itself. inf and -inf are only close to themselves.'
    pass

def isfinite(z):
    'Return True if both the real and imaginary parts of z are finite, else False.'
    pass

def isinf(z):
    'Checks if the real or imaginary part of z is infinite.'
    pass

def isnan(z):
    'Checks if the real or imaginary part of z not a number (NaN).'
    pass

def log(x, y_obj):
    'The logarithm of z to the given base.\n\nIf the base not specified, returns the natural logarithm (base e) of z.'
    pass

def log10(z):
    'Return the base-10 logarithm of z.'
    pass

nan = float('nan')
nanj = builtins.complex()
def phase(z):
    'Return argument, also known as the phase angle, of a complex.'
    pass

pi = 3.141592653589793
def polar(z):
    'Convert a complex from rectangular coordinates to polar coordinates.\n\nr is the distance from 0 and phi the phase angle.'
    pass

def rect(r, phi):
    'Convert from polar coordinates to rectangular coordinates.'
    pass

def sin(z):
    'Return the sine of z.'
    pass

def sinh(z):
    'Return the hyperbolic sine of z.'
    pass

def sqrt(z):
    'Return the square root of z.'
    pass

def tan(z):
    'Return the tangent of z.'
    pass

def tanh(z):
    'Return the hyperbolic tangent of z.'
    pass

tau = 6.283185307179586
