let foundImageUrls = [];
let selectedUrls = new Set();
let blobCache = {};
let objectUrlCache = {};

// Sistema de Cola de Peticiones para evitar crashear el puerto de mensajería asíncrona de Chrome con 200 URLs simultáneas
let activeFetches = 0;
const MAX_CONCURRENT_FETCHES = 3;
const fetchQueue = [];

function processFetchQueue() {
    if (activeFetches >= MAX_CONCURRENT_FETCHES || fetchQueue.length === 0) return;
    
    activeFetches++;
    const task = fetchQueue.shift();
    
    fetchPreviewSafe(task.url)
        .then(objUrl => {
            task.img.src = objUrl;
            activeFetches--;
            processFetchQueue();
        })
        .catch(err => {
            console.warn(`Fallback exhaustivo falló para: ${task.url}`);
            activeFetches--;
            processFetchQueue();
        });
}

async function fetchPreviewSafe(url) {
    if (objectUrlCache[url]) return objectUrlCache[url];
    
    try {
        // Intento 1: Descarga Directa desde la Extensión (Ignora CORS del servidor y es ultrarrápido)
        const res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!res.ok) throw new Error('Direct fetch failed');
        const blob = await res.blob();
        
        blobCache[url] = blob;
        blobCache[`${url}_type`] = res.headers.get('content-type');
        const objUrl = URL.createObjectURL(blob);
        objectUrlCache[url] = objUrl;
        return objUrl;
        
    } catch(err) {
        // Intento 2: Fallback vía Inyección DOM (Si el servidor tiene Anti-Hotlink y nos escupe HTTP 403, como img1tmo)
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || !tabs[0]) return reject('No Tab');
                
                chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadImageFromDOM', url: url }, async (response) => {
                    if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                    if (!response || !response.success) return reject('DOM Script Error');
                    
                    try {
                        const blobRes = await fetch(response.dataUrl);
                        const blob = await blobRes.blob();
                        blobCache[url] = blob;
                        blobCache[`${url}_type`] = response.contentType;
                        const objUrl = URL.createObjectURL(blob);
                        objectUrlCache[url] = objUrl;
                        resolve(objUrl);
                    } catch(e) { reject(e); }
                });
            });
        });
    }
}

document.getElementById('extractBtn').addEventListener('click', async () => {
    const btn = document.getElementById('extractBtn');
    const statusEl = document.getElementById('status');
    
    btn.disabled = true;
    statusEl.textContent = 'Analizando página...';
  
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Aseguramos que el content.js esté inyectado (scripting.executeScript sigue siendo útil para la inyección inicial)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(() => {}); // Ignorar si ya estaba inyectado
      
      // Pedimos las URLs explícitamente a través de un mensaje para evitar el bug de asincronía de executeScript
      const response = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: 'extractImages' }, (res) => resolve(res));
      });
  
      foundImageUrls = response ? response.urls : [];
  
      if (!foundImageUrls || foundImageUrls.length === 0) {
        statusEl.textContent = 'No se encontraron imágenes aptas.';
        btn.disabled = false;
        return;
      }
      
      // Initialize selection with all images
      selectedUrls = new Set(foundImageUrls);

      // Show gallery view
      document.getElementById('initial-view').style.display = 'none';
      document.getElementById('gallery-view').style.display = 'block';
      statusEl.textContent = 'Selecciona las imágenes que deseas incluir.';
      
      renderGallery();
      updateCount();

    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
      btn.disabled = false;
    }
});

function renderGallery() {
    const grid = document.getElementById('image-grid');
    grid.innerHTML = '';
    
    foundImageUrls.forEach(url => {
        const container = document.createElement('div');
        // By default, if the URL is in selectedUrls set, add the 'selected' class
        container.className = 'img-container ' + (selectedUrls.has(url) ? 'selected' : '');
        
        container.onclick = () => {
            if (selectedUrls.has(url)) {
                selectedUrls.delete(url);
                container.classList.remove('selected');
            } else {
                selectedUrls.add(url);
                container.classList.add('selected');
            }
            updateCount();
        };

        const img = document.createElement('img');
        img.loading = 'lazy'; // Improve performance if many images are loaded
        
        // CARGA SEGURA DE MINIATURAS: Usamos encolado y fallback para jamás sobrecargar el navegador
        // y saltar restricciones Anti-Hotlink (TMO) además de Bloqueos CORS cruzados (Blogs).
        if (objectUrlCache[url]) {
            img.src = objectUrlCache[url];
        } else {
            fetchQueue.push({ url, img });
            processFetchQueue();
        }
        
        container.appendChild(img);
        grid.appendChild(container);
    });
}

function updateCount() {
    const countSpan = document.getElementById('countSpan');
    countSpan.textContent = selectedUrls.size;
    
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = selectedUrls.size === 0;
}

document.getElementById('toggleAllBtn').addEventListener('click', () => {
    if (selectedUrls.size === foundImageUrls.length) {
        // Deselect all
        selectedUrls.clear();
        document.getElementById('toggleAllBtn').textContent = 'Seleccionar Todas';
    } else {
        // Select all
        selectedUrls = new Set(foundImageUrls);
        document.getElementById('toggleAllBtn').textContent = 'Deseleccionar Todas';
    }
    renderGallery();
    updateCount();
});

document.getElementById('generateBtn').addEventListener('click', async () => {
    const urlsToProcess = Array.from(selectedUrls);
    if (urlsToProcess.length === 0) return;

    const btn = document.getElementById('generateBtn');
    const toggleBtn = document.getElementById('toggleAllBtn');
    const statusEl = document.getElementById('status');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    
    const format = document.querySelector('input[name="format"]:checked').value;
    
    // Disable UI during generation
    btn.disabled = true;
    toggleBtn.disabled = true;
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
  
    try {
        let doc, JSZipInst;
        let addedPages = 0;
        
        if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        } else if (format === 'cbz') {
            JSZipInst = new JSZip();
        }
        
        const A4_WIDTH = 210;
        const A4_HEIGHT = 297;
  
        for (let i = 0; i < urlsToProcess.length; i++) {
            const url = urlsToProcess[i];
            
            try {
                // Para acelerar el proceso eludimos descargar de nuevo las imagenes usando la caché local
                let blob = blobCache[url];
                let contentType = blobCache[`${url}_type`];
                
                if (!blob) {
                    // Cache Miss durante la exportación final (Si el usuario dio click muy rápido en "Generar")
                    await fetchPreviewSafe(url);
                    blob = blobCache[url];
                    contentType = blobCache[`${url}_type`];
                }
                
                if (!contentType || (!contentType.startsWith('image/') && contentType !== 'application/octet-stream')) {
                    throw new Error(`Contenido no es imagen: ${contentType}`);
                }
                
                if (format === 'pdf') {
                    // jsPDF soporta nativamente JPEG y PNG. WebP, AVIF u otros pueden generar errores.
                    // Si detectamos formatos no soportados, usamos un Canvas para transcodificarlos a JPEG.
                    let base64data;
                    
                    if (contentType.includes('jpeg') || contentType.includes('jpg') || contentType.includes('png')) {
                        // Formatos amigables para jsPDF, lectura directa:
                        base64data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        // WebP u otros formatos (AVIF). Forzamos render en un canvas y exportamos a JPEG (DataURL)
                        // Para pintar un blob en un canvas, lo encapsulamos en un ImageBitmap (nativo del navegador)
                        const imageBitmap = await createImageBitmap(blob);
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = imageBitmap.width;
                        canvas.height = imageBitmap.height;
                        
                        const ctx = canvas.getContext('2d');
                        // Llenar fondo blanco (por si el webp tenía transparencias, ya que jpeg no las soporta)
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(imageBitmap, 0, 0);
                        
                        // Exportar a base64 DataURI con calidad 90%
                        base64data = canvas.toDataURL('image/jpeg', 0.9);
                        
                        // Liberar memoria del bitmap
                        imageBitmap.close();
                    }
        
                    const imgProps = doc.getImageProperties(base64data);
                    let imgWidth = A4_WIDTH;
                    let imgHeight = (imgProps.height * A4_WIDTH) / imgProps.width;
        
                    if (imgHeight > A4_HEIGHT) {
                      imgHeight = A4_HEIGHT;
                      imgWidth = (imgProps.width * A4_HEIGHT) / imgProps.height;
                    }
        
                    const x = (A4_WIDTH - imgWidth) / 2;
                    const y = (A4_HEIGHT - imgHeight) / 2;
        
                    if (addedPages > 0) doc.addPage();
                    doc.addImage(base64data, imgProps.fileType || 'JPEG', x, y, imgWidth, imgHeight);
                } else if (format === 'cbz') {
                    // Extract extension
                    let ext = 'jpg';
                    if (contentType.includes('png')) ext = 'png';
                    else if (contentType.includes('webp')) ext = 'webp';
                    else if (contentType.includes('gif')) ext = 'gif';
                    
                    // Pad index to maintain ordering (e.g. 001.jpg)
                    const filename = String(i + 1).padStart(3, '0') + '.' + ext;
                    JSZipInst.file(filename, blob);
                }
                
                addedPages++;
            } catch (err) {
                console.warn(`Imagen Saltada [${url}]:`, err);
            }
    
            // Visual feedback
            const percent = Math.round(((i + 1) / urlsToProcess.length) * 100);
            progressBar.style.width = `${percent}%`;
            statusEl.textContent = `Procesando imagen ${i + 1} de ${urlsToProcess.length}...`;
        }
    
        if (addedPages === 0) {
            statusEl.textContent = 'Ninguna imagen fue convertida con éxito.';
        } else {
            if (format === 'pdf') {
                statusEl.textContent = 'Generando archivo PDF...';
                doc.save('imagenes_web.pdf');
            } else if (format === 'cbz') {
                statusEl.textContent = 'Empaquetando archivo CBZ...';
                const content = await JSZipInst.generateAsync({ type: 'blob' });
                const objUrl = URL.createObjectURL(content);
                
                // Alternativa a chrome.downloads que funciona dentro del popup DOM
                const a = document.createElement("a");
                a.style.display = "none";
                a.href = objUrl;
                a.download = "imagenes_web.cbz";
                document.body.appendChild(a);
                a.click();
                
                // Note: Not revoking immediately to ensure download starts
                setTimeout(() => {
                    URL.revokeObjectURL(objUrl);
                    a.remove();
                }, 5000);
            }
            statusEl.textContent = '¡Descarga completada!';
        }
    } catch (error) {
        statusEl.textContent = `Error crítico: ${error.message}`;
    } finally {
        // Re-enable UI
        btn.disabled = false;
        toggleBtn.disabled = false;
        setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);
    }
});
