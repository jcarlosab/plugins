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
    removeShorts();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                removeShorts();
                break;
            }
        }
    });

    function startObserver() {
        const contentContainer = document.querySelector('#content');
        if (contentContainer) {
            observer.observe(contentContainer, {
                childList: true,
                subtree: true
            });
        } else {
            setTimeout(startObserver, 100);
        }
    }

    startObserver();
}

initShortsBlocker();

document.addEventListener('yt-navigate-finish', removeShorts);