// content.js
// Content Script: Se inyecta en la pestaña activa para extraer información del DOM de forma pasiva.

// Evita re-inyección accidental de los Listeners
if (typeof window.imgPackerInjected === 'undefined') {
    window.imgPackerInjected = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // ACCIÓN 1: Localizar las URLs de todas las imágenes de esta página
        if (request.action === 'extractImages') {
            const images = Array.from(document.querySelectorAll('img'));
            const imageUrls = new Set();
            
            for (const img of images) {
                let src = img.getAttribute('data-src') || img.currentSrc || img.src;
                if (!src || src.startsWith('data:image/svg+xml')) continue;
                
                try {
                    src = new URL(src, window.location.href).href;
                } catch (e) { continue; }
                
                const width = img.naturalWidth || img.clientWidth || img.width;
                const height = img.naturalHeight || img.clientHeight || img.height;
                
                if (width > 0 && height > 0 && width < 50 && height < 50) continue;
                
                imageUrls.add(src);
            }
            // Retorna masivamente las descargas a popup.js
            sendResponse({ urls: Array.from(imageUrls) });
            return true;
        }

        // ACCIÓN 2: Descargar un binario (Blob) simulando que es la página misma para saltar bloqueos (CORS/Hotlink)
        if (request.action === "downloadImageFromDOM") {
        // El Referer se inyecta automáticamente por la regla declarativeNetRequest en rules.json
        // Las cookies viajan con 'credentials: include', el navegador las adjuntará
        fetch(request.url, {
            credentials: 'include'
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.blob().then(blob => ({ blob, contentType: res.headers.get('content-type') }));
            })
            .then(({blob, contentType}) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    sendResponse({ 
                        success: true, 
                        dataUrl: reader.result, 
                        contentType: contentType 
                    });
                };
                reader.onerror = () => {
                    sendResponse({ success: false, error: 'File read error' });
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            
        return true; // Asíncrono
    }
});
}
