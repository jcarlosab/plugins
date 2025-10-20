let protectionEnabled = true;
let eventListeners = [];

function removeAllEventListeners() {
  // Lista de todos los tipos de eventos comunes
  const eventTypes = [
    'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
    'touchstart', 'touchend', 'touchmove', 'touchcancel',
    'keydown', 'keyup', 'keypress',
    'contextmenu'
  ];
  
  // Limpiar listeners antiguos
  eventListeners.forEach(({ type, listener }) => {
    document.removeEventListener(type, listener, true);
  });
  eventListeners = [];
  
  // Solo aplicar si está activado
  if (!protectionEnabled) {
    return;
  }
  
  // Método efectivo: Detener la propagación de eventos maliciosos
  eventTypes.forEach(eventType => {
    const listener = function(e) {
      // NO bloquear si el evento viene de nuestro plugin
      if (e.target.closest('.link-viewer-popup') || 
          e.target.closest('.link-overlay-tooltip') ||
          e.target.classList.contains('link-notification')) {
        return; // Permitir eventos del plugin
      }
      
      // NO bloquear elementos interactivos normales (input, select, button, textarea, a)
      const interactiveElements = ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'A', 'LABEL'];
      if (interactiveElements.includes(e.target.tagName)) {
        // Verificar que no sea un elemento con atributos sospechosos
        const hasSuspiciousAttrs = e.target.hasAttribute('onclick') || 
                                   e.target.hasAttribute('data-ad') ||
                                   e.target.classList.toString().match(/ad|popup|banner/i);
        
        if (!hasSuspiciousAttrs) {
          return; // Permitir elementos interactivos legítimos
        }
      }
      
      // Bloquear el resto
      e.stopImmediatePropagation();
      e.stopPropagation();
    };
    
    document.addEventListener(eventType, listener, true);
    eventListeners.push({ type: eventType, listener });
  });
  
  // Bloquear window.open
  if (protectionEnabled) {
    window.open = function() {
      return null;
    };
  }
  
  // Restaurar scroll
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.style.position = '';
  
  // Mostrar notificación
  showProtectionNotification(true);
}

function showProtectionNotification(enabled) {
  const notification = document.createElement('div');
  notification.className = 'link-notification';
  notification.textContent = enabled ? '🛡️ Protección activada' : '⚠️ Protección desactivada';
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 2000);
}

// Cargar estado de protección desde storage
chrome.storage.local.get(['protectionEnabled'], (result) => {
  protectionEnabled = result.protectionEnabled !== false; // Por defecto true
  
  // EJECUTAR AUTOMÁTICAMENTE AL CARGAR LA PÁGINA
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeAllEventListeners);
  } else {
    removeAllEventListeners();
  }
});

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'showList') {
    showLinksList();
  } else if (request.action === 'showOverlay') {
    showLinksOverlay();
  } else if (request.action === 'hideAll') {
    hideAll();
  } else if (request.action === 'toggleProtection') {
    protectionEnabled = request.enabled;
    removeAllEventListeners(); // Reaplica o quita la protección
    showProtectionNotification(protectionEnabled);
  }
});

// Mostrar lista de enlaces como popup
function showLinksList() {
  // Remover elementos existentes
  const existing = document.getElementById('link-viewer-popup');
  if (existing) existing.remove();
  
  const overlays = document.querySelectorAll('.link-overlay-tooltip');
  overlays.forEach(el => el.remove());
  
  // Obtener todos los enlaces
  const links = document.querySelectorAll('a[href]');
  const linkData = Array.from(links).map((link, index) => ({
    index: index + 1,
    href: link.href,
    text: link.textContent.trim() || '(sin texto)'
  }));
  
  // Crear popup centrado
  const popup = document.createElement('div');
  popup.id = 'link-viewer-popup';
  popup.className = 'link-viewer-popup';
  
  popup.innerHTML = `
    <div class="popup-header">
      <h3>🔗 Enlaces encontrados: ${linkData.length}</h3>
      <button id="close-popup" class="close-btn-popup">✕</button>
    </div>
    <div class="popup-actions">
      <button id="copy-all-links" class="action-btn primary">
        📋 Copiar Todos
      </button>
    </div>
    <div id="links-container" class="links-container"></div>
  `;
  
  document.body.appendChild(popup);
  
  const container = document.getElementById('links-container');
  
  linkData.forEach(link => {
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    
    linkItem.innerHTML = `
      <div class="link-number">#${link.index}</div>
      <div class="link-info">
        <div class="link-text">${link.text.substring(0, 40)}${link.text.length > 40 ? '...' : ''}</div>
        <div class="link-url">${link.href}</div>
      </div>
      <button class="copy-btn" data-href="${link.href}">📋</button>
    `;
    
    container.appendChild(linkItem);
  });
  
  // Event listeners
  document.getElementById('close-popup').addEventListener('click', () => {
    popup.remove();
  });
  
  document.getElementById('copy-all-links').addEventListener('click', () => {
    const allLinks = linkData.map(l => l.href).join('\n');
    navigator.clipboard.writeText(allLinks).then(() => {
      showNotification('¡Todos los enlaces copiados!');
    });
  });
  
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const href = e.currentTarget.getAttribute('data-href');
      navigator.clipboard.writeText(href).then(() => {
        const originalText = e.currentTarget.textContent;
        e.currentTarget.textContent = '✓';
        e.currentTarget.style.background = '#4CAF50';
        setTimeout(() => {
          e.currentTarget.textContent = originalText;
          e.currentTarget.style.background = '';
        }, 1500);
      });
    });
  });
  
  // Cerrar al hacer clic fuera
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  });
}

// Mostrar enlaces como overlay sobre cada enlace
function showLinksOverlay() {
  // Remover elementos existentes
  const existing = document.getElementById('link-viewer-popup');
  if (existing) existing.remove();
  
  const overlays = document.querySelectorAll('.link-overlay-tooltip');
  overlays.forEach(el => el.remove());
  
  // Obtener todos los enlaces
  const links = document.querySelectorAll('a[href]');
  
  links.forEach((link, index) => {
    const rect = link.getBoundingClientRect();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'link-overlay-tooltip';
    tooltip.innerHTML = `
      <span class="overlay-number">#${index + 1}</span>
      <span class="overlay-url">${link.href}</span>
      <button class="overlay-copy-btn" data-href="${link.href}">📋</button>
    `;
    
    tooltip.style.top = `${window.scrollY + rect.top - 35}px`;
    tooltip.style.left = `${window.scrollX + rect.left}px`;
    
    document.body.appendChild(tooltip);
    
    // Event listener para copiar
    tooltip.querySelector('.overlay-copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const href = e.target.getAttribute('data-href');
      navigator.clipboard.writeText(href).then(() => {
        e.target.textContent = '✓';
        e.target.style.background = '#4CAF50';
        setTimeout(() => {
          e.target.textContent = '📋';
          e.target.style.background = '';
        }, 1500);
      });
    });
  });
}

// Ocultar
function hideAll() {
  const popup = document.getElementById('link-viewer-popup');
  if (popup) popup.remove();
  
  const overlays = document.querySelectorAll('.link-overlay-tooltip');
  overlays.forEach(el => el.remove());
}

// Mostrar notificación temporal
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'link-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}