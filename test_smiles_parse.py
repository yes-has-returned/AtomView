from rdkit import Chem

# Test different SMILES formats
test_cases = [
    "[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]",  # Current format
    "[Co+3](N)(N)(N)(N)(N)N",  # Just the complex without chlorides
    "N-[Co+3](-N)(-N)(-N)(-N)-N",  # Explicit dashes
]

for smiles in test_cases:
    print(f"\nTesting: {smiles}")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        print("  FAILED to parse")
        continue
    
    print(f"  Atoms: {[a.GetSymbol() for a in mol.GetAtoms()]}")
    print(f"  Bonds:")
    co_bonds = []
    for bond in mol.GetBonds():
        start_idx = bond.GetBeginAtomIdx()
        end_idx = bond.GetEndAtomIdx()
        start_sym = mol.GetAtomWithIdx(start_idx).GetSymbol()
        end_sym = mol.GetAtomWithIdx(end_idx).GetSymbol()
        print(f"    {start_idx}({start_sym}) - {end_idx}({end_sym})")
        if start_sym == "Co" or end_sym == "Co":
            co_bonds.append((start_idx, end_idx))
    
    print(f"  Co bonds: {len(co_bonds)}")
    
    # Now check after AddHs
    mol_h = Chem.AddHs(mol)
    print(f"  After AddHs: {mol_h.GetNumAtoms()} atoms")
    co_bonds_h = 0
    for bond in mol_h.GetBonds():
        start_idx = bond.GetBeginAtomIdx()
        end_idx = bond.GetEndAtomIdx()
        if mol_h.GetAtomWithIdx(start_idx).GetSymbol() == "Co" or mol_h.GetAtomWithIdx(end_idx).GetSymbol() == "Co":
            co_bonds_h += 1
    print(f"  Co bonds after AddHs: {co_bonds_h}")
