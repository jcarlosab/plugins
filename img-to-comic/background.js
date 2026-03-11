chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchImage') {
        const targetUrl = request.url;
        
        // Ejecutamos fetch en el Background Service Worker.
        // Aquí los headers están totalmente controlados por la extensión y no heredan las restricciones
        // orgánicas de un iframe / Document activo.
        fetch(targetUrl, {
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: {
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Leemos el content type real proporcionado por el servidor
            const contentType = response.headers.get('content-type');
            
            return response.blob().then(blob => ({ blob, contentType }));
        })
        .then(({ blob, contentType }) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Devolvemos la imagen transcodificada en Base64 por la comunicación de mensajes
                sendResponse({ 
                    success: true, 
                    dataUrl: reader.result,
                    contentType: contentType 
                });
            };
            reader.onerror = () => {
                sendResponse({ success: false, error: 'Failed to read Blob as Data URL' });
            };
            reader.readAsDataURL(blob);
        })
        .catch(error => {
            console.error('Service worker fetch error:', error);
            sendResponse({ success: false, error: error.message });
        });

        // Retornar true indica que enviaremos la respuesta de forma asíncrona
        return true; 
    }
});
