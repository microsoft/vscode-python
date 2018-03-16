import builtins

class Random(builtins.object):
    'Random() -> create a random number generator with its own internal state.'
    __class__ = Random
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def getrandbits(self, k):
        'getrandbits(k) -> x.  Generates an int with k random bits.'
        pass
    
    def getstate(self):
        'getstate() -> tuple containing the current state.'
        pass
    
    def random(self):
        'random() -> x in the interval [0, 1).'
        pass
    
    def seed(self, n):
        'seed([n]) -> None.  Defaults to current time.'
        pass
    
    def setstate(self, state):
        'setstate(state) -> None.  Restores generator state.'
        pass
    

__doc__ = 'Module implements the Mersenne Twister random number generator.'
__name__ = '_random'
__package__ = ''
