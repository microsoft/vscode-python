"""Python Import Magic - automagically add, remove and manage imports

This module just exports the main API of importmagic.
"""

__author__ = 'Alec Thomas <alec@swapoff.org>'
__version__ = '0.1.7'

from importmagic.importer import Import, Imports, get_update, update_imports
from importmagic.index import SymbolIndex
from importmagic.symbols import Scope
