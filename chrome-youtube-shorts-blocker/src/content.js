function removeShorts() {
    
    // Eliminar shorts de la página principal
    const shortsElements = document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-section-renderer');
    console.log('Elementos encontrados:', shortsElements.length);
    shortsElements.forEach(element => {
        element.remove();
    });

    // Eliminar acceso a Shorts en la barra lateral buscando la palabra "Shorts"
    document.querySelectorAll('ytd-guide-entry-renderer').forEach(entry => {
        if (entry.textContent && entry.textContent.trim().toLowerCase().includes('shorts')) {
            entry.remove();
        }
    });
}

function initShortsBlocker() {
    // Ejecutar la función inmediatamente para limpiar los shorts en la primera carga
    removeShorts();

    // Observador para detectar cambios en el DOM
    const observer = new MutationObserver(() => {
        removeShorts();
    });

    // Iniciar el observador
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

document.addEventListener('DOMContentLoaded', initShortsBlocker);
document.addEventListener('yt-navigate-finish', initShortsBlocker);