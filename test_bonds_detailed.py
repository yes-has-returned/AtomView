from rdkit import Chem
from moleculerenderer import generate_molecule_data

# First check: what does RDKit parse from the SMILES?
test_smiles = "[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]"
print(f"Testing SMILES: {test_smiles}")

mol = Chem.MolFromSmiles(test_smiles)
print(f"\nRDKit parsed molecule:")
print(f"  Atoms: {[a.GetSymbol() for a in mol.GetAtoms()]}")
print(f"  Bonds from RDKit.GetBonds():")
for bond in mol.GetBonds():
    start_idx = bond.GetBeginAtomIdx()
    end_idx = bond.GetEndAtomIdx()
    print(f"    {start_idx}({mol.GetAtomWithIdx(start_idx).GetSymbol()}) - {end_idx}({mol.GetAtomWithIdx(end_idx).GetSymbol()}) type={bond.GetBondType()}")

# Now check what generate_molecule_data returns
print(f"\nAfter generate_molecule_data:")
positions, bonds = generate_molecule_data(test_smiles)
print(f"  Returned bonds:")
for start_idx, end_idx, bond_type in bonds:
    start_sym = positions[start_idx].symbol
    end_sym = positions[end_idx].symbol
    print(f"    {start_idx}({start_sym}) - {end_idx}({end_sym}) type={bond_type}")
