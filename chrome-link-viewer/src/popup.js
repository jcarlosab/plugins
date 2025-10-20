// Cargar estado de protección al abrir el popup
chrome.storage.local.get(['protectionEnabled'], (result) => {
  const isEnabled = result.protectionEnabled !== false; // Por defecto true
  document.getElementById('protectionToggle').checked = isEnabled;
});

// Toggle de protección
document.getElementById('protectionToggle').addEventListener('change', async (e) => {
  const isEnabled = e.target.checked;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Guardar estado
  chrome.storage.local.set({ protectionEnabled: isEnabled });
  
  // Enviar mensaje al content script
  chrome.tabs.sendMessage(tab.id, { 
    action: 'toggleProtection',
    enabled: isEnabled
  });
  
  showStatus(isEnabled ? '🛡️ Protección activada' : '⚠️ Protección desactivada', 
             isEnabled ? 'success' : 'info');
});

document.getElementById('showList').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'showList' });
  showStatus('Lista de enlaces activada', 'success');
});

document.getElementById('showOverlay').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'showOverlay' });
  showStatus('Overlay sobre enlaces activado', 'success');
});

document.getElementById('hideAll').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'hideAll' });
  showStatus('Todo ocultado', 'info');
});
