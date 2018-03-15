__doc__ = 'This module is always available.  It provides access to the\nmathematical functions defined by the C standard.'
__name__ = 'math'
__package__ = ''
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
    'ceil(x)\n\nReturn the ceiling of x as an Integral.\nThis is the smallest integer >= x.'
    pass

def copysign(x, y):
    'copysign(x, y)\n\nReturn a float with the magnitude (absolute value) of x but the sign \nof y. On platforms that support signed zeros, copysign(1.0, -0.0) \nreturns -1.0.\n'
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
    'floor(x)\n\nReturn the floor of x as an Integral.\nThis is the largest integer <= x.'
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

def gcd(x, y):
    'gcd(x, y) -> int\ngreatest common divisor of x and y'
    pass

def hypot(x, y):
    'hypot(x, y)\n\nReturn the Euclidean distance, sqrt(x*x + y*y).'
    pass

inf = float('inf')
def isclose(a, b):
    'isclose(a, b, *, rel_tol=1e-09, abs_tol=0.0) -> bool\n\nDetermine whether two floating point numbers are close in value.\n\n   rel_tol\n       maximum difference for being considered "close", relative to the\n       magnitude of the input values\n    abs_tol\n       maximum difference for being considered "close", regardless of the\n       magnitude of the input values\n\nReturn True if a is close in value to b, and False otherwise.\n\nFor the values to be considered close, the difference between them\nmust be smaller than at least one of the tolerances.\n\n-inf, inf and NaN behave similarly to the IEEE 754 Standard.  That\nis, NaN is not close to anything, even itself.  inf and -inf are\nonly close to themselves.'
    pass

def isfinite(x):
    'isfinite(x) -> bool\n\nReturn True if x is neither an infinity nor a NaN, and False otherwise.'
    pass

def isinf(x):
    'isinf(x) -> bool\n\nReturn True if x is a positive or negative infinity, and False otherwise.'
    pass

def isnan(x):
    'isnan(x) -> bool\n\nReturn True if x is a NaN (not a number), and False otherwise.'
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

def log2(x):
    'log2(x)\n\nReturn the base 2 logarithm of x.'
    pass

def modf(x):
    'modf(x)\n\nReturn the fractional and integer parts of x.  Both results carry the sign\nof x and are floats.'
    pass

nan = float('nan')
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

tau = 6.283185307179586
def trunc(x):
    'trunc(x:Real) -> Integral\n\nTruncates x to the nearest Integral toward 0. Uses the __trunc__ magic method.'
    pass

