import requests
import json

# Test what the API returns
url = "http://127.0.0.1:5000/renderbackend/name?name=hexaamminecobalt(III)+chloride&methods=PubChem,OPSIN&force_polymerization=false"

try:
    response = requests.get(url, timeout=10)
    print(f"Status code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\nNumber of atoms: {len(data.get('atoms', []))}")
        print(f"Number of bonds: {len(data.get('bonds', []))}")
        
        print("\nBonds returned:")
        for i, bond in enumerate(data.get('bonds', [])):
            print(f"  {i}: start={bond['start']}, end={bond['end']}, type={bond['type']}")
        
        print("\nAtoms (first 5):")
        for i, atom in enumerate(data.get('atoms', [])[:5]):
            print(f"  {i}: {atom['symbol']} at ({atom['x']:.2f}, {atom['y']:.2f}, {atom['z']:.2f})")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
