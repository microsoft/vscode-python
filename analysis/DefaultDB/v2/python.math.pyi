__doc__ = 'This module is always available.  It provides access to the\nmathematical functions defined by the C standard.'
__name__ = 'math'
__package__ = None
def acos(x):
    'acos(x)\n\nReturn the arc cosine (measured in radians) of x.'
    pass

def acosh(x):
    'acosh(x)\n\nReturn the inverse hyperbolic cosine of x.'
    pass

def asin(x):
    'asin(x)\n\nReturn the arc sine (measured in radians) of x.'
    pass

def asinh(x):
    'asinh(x)\n\nReturn the inverse hyperbolic sine of x.'
    pass

def atan(x):
    'atan(x)\n\nReturn the arc tangent (measured in radians) of x.'
    pass

def atan2(y, x):
    'atan2(y, x)\n\nReturn the arc tangent (measured in radians) of y/x.\nUnlike atan(y/x), the signs of both x and y are considered.'
    pass

def atanh(x):
    'atanh(x)\n\nReturn the inverse hyperbolic tangent of x.'
    pass

def ceil(x):
    'ceil(x)\n\nReturn the ceiling of x as a float.\nThis is the smallest integral value >= x.'
    pass

def copysign(x, y):
    'copysign(x, y)\n\nReturn x with the sign of y.'
    pass

def cos(x):
    'cos(x)\n\nReturn the cosine of x (measured in radians).'
    pass

def cosh(x):
    'cosh(x)\n\nReturn the hyperbolic cosine of x.'
    pass

def degrees(x):
    'degrees(x)\n\nConvert angle x from radians to degrees.'
    pass

e = 2.718281828459045
def erf(x):
    'erf(x)\n\nError function at x.'
    pass

def erfc(x):
    'erfc(x)\n\nComplementary error function at x.'
    pass

def exp(x):
    'exp(x)\n\nReturn e raised to the power of x.'
    pass

def expm1(x):
    'expm1(x)\n\nReturn exp(x)-1.\nThis function avoids the loss of precision involved in the direct evaluation of exp(x)-1 for small x.'
    pass

def fabs(x):
    'fabs(x)\n\nReturn the absolute value of the float x.'
    pass

def factorial(x):
    'factorial(x) -> Integral\n\nFind x!. Raise a ValueError if x is negative or non-integral.'
    pass

def floor(x):
    'floor(x)\n\nReturn the floor of x as a float.\nThis is the largest integral value <= x.'
    pass

def fmod(x, y):
    'fmod(x, y)\n\nReturn fmod(x, y), according to platform C.  x % y may differ.'
    pass

def frexp(x):
    'frexp(x)\n\nReturn the mantissa and exponent of x, as pair (m, e).\nm is a float and e is an int, such that x = m * 2.**e.\nIf x is 0, m and e are both 0.  Else 0.5 <= abs(m) < 1.0.'
    pass

def fsum(iterable):
    'fsum(iterable)\n\nReturn an accurate floating point sum of values in the iterable.\nAssumes IEEE-754 floating point arithmetic.'
    pass

def gamma(x):
    'gamma(x)\n\nGamma function at x.'
    pass

def hypot(x, y):
    'hypot(x, y)\n\nReturn the Euclidean distance, sqrt(x*x + y*y).'
    pass

def isinf(x):
    'isinf(x) -> bool\n\nCheck if float x is infinite (positive or negative).'
    pass

def isnan(x):
    'isnan(x) -> bool\n\nCheck if float x is not a number (NaN).'
    pass

def ldexp(x, i):
    'ldexp(x, i)\n\nReturn x * (2**i).'
    pass

def lgamma(x):
    'lgamma(x)\n\nNatural logarithm of absolute value of Gamma function at x.'
    pass

def log(x, base):
    'log(x[, base])\n\nReturn the logarithm of x to the given base.\nIf the base not specified, returns the natural logarithm (base e) of x.'
    pass

def log10(x):
    'log10(x)\n\nReturn the base 10 logarithm of x.'
    pass

def log1p(x):
    'log1p(x)\n\nReturn the natural logarithm of 1+x (base e).\nThe result is computed in a way which is accurate for x near zero.'
    pass

def modf(x):
    'modf(x)\n\nReturn the fractional and integer parts of x.  Both results carry the sign\nof x and are floats.'
    pass

pi = 3.141592653589793
def pow(x, y):
    'pow(x, y)\n\nReturn x**y (x to the power of y).'
    pass

def radians(x):
    'radians(x)\n\nConvert angle x from degrees to radians.'
    pass

def sin(x):
    'sin(x)\n\nReturn the sine of x (measured in radians).'
    pass

def sinh(x):
    'sinh(x)\n\nReturn the hyperbolic sine of x.'
    pass

def sqrt(x):
    'sqrt(x)\n\nReturn the square root of x.'
    pass

def tan(x):
    'tan(x)\n\nReturn the tangent of x (measured in radians).'
    pass

def tanh(x):
    'tanh(x)\n\nReturn the hyperbolic tangent of x.'
    pass

def trunc():
    'trunc(x:Real) -> Integral\n\nTruncates x to the nearest Integral toward 0. Uses the __trunc__ magic method.'
    pass

