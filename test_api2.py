import requests

url = "http://127.0.0.1:5000/renderbackend/name?name=hexaamminecobalt(III)+chloride&methods=PubChem,OPSIN&force_polymerization=false"

try:
    response = requests.get(url, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        
        print("All atoms:")
        for i, atom in enumerate(data.get('atoms', [])):
            print(f"  {i}: {atom['symbol']} (charge={atom['charge']})")
        
        print("\nAll bonds:")
        for i, bond in enumerate(data.get('bonds', [])):
            start_atom = data['atoms'][bond['start']]['symbol']
            end_atom = data['atoms'][bond['end']]['symbol']
            print(f"  {bond['start']}({start_atom}) - {bond['end']}({end_atom}) type={bond['type']}")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
