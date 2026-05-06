const nameRadio = document.getElementById('type-name');
const smilesRadio = document.getElementById('type-smiles');
const nameField = document.getElementById('name-field');
const smilesField = document.getElementById('smiles-field');
const algorithmCheckboxes = document.querySelectorAll('#algorithms .check-group');

function toggleInputs() {
    if (nameRadio.checked) {
        nameField.style.display = 'flex';
        smilesField.style.display = 'none';
        // Enable render methods
        algorithmCheckboxes.forEach(row => row.classList.remove('disabled'));
    } else {
        nameField.style.display = 'none';
        smilesField.style.display = 'flex';
        // Disable/grey out render methods
        algorithmCheckboxes.forEach(row => row.classList.add('disabled'));
    }
}

nameRadio.addEventListener('change', toggleInputs);
smilesRadio.addEventListener('change', toggleInputs);

// Initialize on page load
toggleInputs();