import builtins

__doc__ = None
__name__ = 'audioop'
__package__ = ''
def add(fragment1, fragment2, width):
    'Return a fragment which is the addition of the two samples passed as parameters.'
    pass

def adpcm2lin(fragment, width, state):
    'Decode an Intel/DVI ADPCM coded fragment to a linear fragment.'
    pass

def alaw2lin(fragment, width):
    'Convert sound fragments in a-LAW encoding to linearly encoded sound fragments.'
    pass

def avg(fragment, width):
    'Return the average over all samples in the fragment.'
    pass

def avgpp(fragment, width):
    'Return the average peak-peak value over all samples in the fragment.'
    pass

def bias(fragment, width, bias):
    'Return a fragment that is the original fragment with a bias added to each sample.'
    pass

def byteswap(fragment, width):
    'Convert big-endian samples to little-endian and vice versa.'
    pass

def cross(fragment, width):
    'Return the number of zero crossings in the fragment passed as an argument.'
    pass

class error(builtins.Exception):
    __class__ = error
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'audioop'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

def findfactor(fragment, reference):
    'Return a factor F such that rms(add(fragment, mul(reference, -F))) is minimal.'
    pass

def findfit(fragment, reference):
    'Try to match reference as well as possible to a portion of fragment.'
    pass

def findmax(fragment, length):
    'Search fragment for a slice of specified number of samples with maximum energy.'
    pass

def getsample(fragment, width, index):
    'Return the value of sample index from the fragment.'
    pass

def lin2adpcm(fragment, width, state):
    'Convert samples to 4 bit Intel/DVI ADPCM encoding.'
    pass

def lin2alaw(fragment, width):
    'Convert samples in the audio fragment to a-LAW encoding.'
    pass

def lin2lin(fragment, width, newwidth):
    'Convert samples between 1-, 2-, 3- and 4-byte formats.'
    pass

def lin2ulaw(fragment, width):
    'Convert samples in the audio fragment to u-LAW encoding.'
    pass

def max(fragment, width):
    'Return the maximum of the absolute value of all samples in a fragment.'
    pass

def maxpp(fragment, width):
    'Return the maximum peak-peak value in the sound fragment.'
    pass

def minmax(fragment, width):
    'Return the minimum and maximum values of all samples in the sound fragment.'
    pass

def mul(fragment, width, factor):
    'Return a fragment that has all samples in the original fragment multiplied by the floating-point value factor.'
    pass

def ratecv(fragment, width, nchannels, inrate, outrate, state, weightA, weightB):
    'Convert the frame rate of the input fragment.'
    pass

def reverse(fragment, width):
    'Reverse the samples in a fragment and returns the modified fragment.'
    pass

def rms(fragment, width):
    'Return the root-mean-square of the fragment, i.e. sqrt(sum(S_i^2)/n).'
    pass

def tomono(fragment, width, lfactor, rfactor):
    'Convert a stereo fragment to a mono fragment.'
    pass

def tostereo(fragment, width, lfactor, rfactor):
    'Generate a stereo fragment from a mono fragment.'
    pass

def ulaw2lin(fragment, width):
    'Convert sound fragments in u-LAW encoding to linearly encoded sound fragments.'
    pass

