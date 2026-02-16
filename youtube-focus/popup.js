document.addEventListener('DOMContentLoaded', () => {
    const keys = ['blockShorts', 'hideComments', 'hideSecondary'];

    // Load saved settings
    chrome.storage.local.get(keys, (result) => {
        keys.forEach(key => {
            const toggle = document.getElementById(key);
            // Default to true if not set
            toggle.checked = result[key] !== false;
        });
    });

    // Save settings on change
    keys.forEach(key => {
        document.getElementById(key).addEventListener('change', (e) => {
            const setting = {};
            setting[key] = e.target.checked;
            chrome.storage.local.set(setting);
        });
    });
});
