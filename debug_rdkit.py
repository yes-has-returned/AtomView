from rdkit import Chem

# Test the hexaamminecobalt(III) chloride complex
test_smiles = "[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]"
print(f"Testing SMILES: {test_smiles}")

mol = Chem.MolFromSmiles(test_smiles)
if not mol:
    print("Failed to parse SMILES")
else:
    print(f"Original RDKit molecule has {mol.GetNumAtoms()} atoms")
    for i, atom in enumerate(mol.GetAtoms()):
        print(f"  idx={i}: {atom.GetSymbol()} (formal_charge={atom.GetFormalCharge()})")
    
    print(f"\nRDKit bonds:")
    for bond in mol.GetBonds():
        start_idx = bond.GetBeginAtomIdx()
        end_idx = bond.GetEndAtomIdx()
        print(f"  {start_idx}({mol.GetAtomWithIdx(start_idx).GetSymbol()}) - {end_idx}({mol.GetAtomWithIdx(end_idx).GetSymbol()})")
    
    # Now check what happens after AddHs
    mol_h = Chem.AddHs(mol)
    print(f"\nAfter AddHs: {mol_h.GetNumAtoms()} atoms")
    print(f"Bonds after AddHs:")
    for bond in mol_h.GetBonds():
        start_idx = bond.GetBeginAtomIdx()
        end_idx = bond.GetEndAtomIdx()
        print(f"  {start_idx}({mol_h.GetAtomWithIdx(start_idx).GetSymbol()}) - {end_idx}({mol_h.GetAtomWithIdx(end_idx).GetSymbol()})")
