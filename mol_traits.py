import pubchempy as pcp
from chemicals import CAS_from_any
from chemicals import Chemical
import chemparse
from rdkit import Chem
from rdkit.Chem import Descriptors

def get_molecule_traits(smiles):
    compounds = pcp.get_compounds(smiles, namespace='smiles')
    name = compounds[0].iupac_name if compounds else None
    if name == None:
        return None
    # 1. pubchem search
    molecule = pcp.get_compounds(smiles, 'smiles')[0]

    molecule_traits = molecule.to_dict()
    
    required_molecule_traits = ["charge", "iupac_name", "exact_mass", ]
    molecule_traits = {i:molecule_traits[i] for i in molecule_traits if i in required_molecule_traits}

    #2. chemicals database search
    molecule = Chemical(name)