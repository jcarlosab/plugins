# Link Viewer - Plugin para Chrome

Plugin de Chrome que permite visualizar y copiar todos los enlaces href de una página web de dos formas diferentes.

## Características

- **Vista de Lista (Popup)**: Muestra todos los enlaces en un popup centrado con diseño moderno
- **Vista Overlay**: Muestra tooltips en una línea sobre cada enlace con la URL y botón de copiar
- **Copiar Enlaces**: Copia fácilmente cualquier enlace o todos a la vez al portapapeles
- **Interfaz Moderna**: Diseño limpio y profesional con animaciones suaves

## Estructura del Plugin

```
link-viewer/
├── assets/
│   └── images/
│		├── icon16.png
│	    ├── icon48.png
│	    └── icon128.png
├── styles/
│	├── styles.css
│   └── popup.css
├── src/ 
│	├── popup.html
│	├── popup.js
│	└── content.js
└── manifest.json
```

## Instalación

### Paso 1: Descargar y extraer `chrome-link-viewer`

### Paso 2: Cargar el plugin en Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **Modo de desarrollador** (interruptor en la esquina superior derecha)
3. Haz clic en **Cargar extensión sin empaquetar**
4. Selecciona la carpeta `chrome-link-viewer`
5. ¡Listo! El plugin aparecerá en tu barra de extensiones

## 2 Uso

1. Haz clic en el icono del plugin en la barra de extensiones
2. Selecciona una de las opciones:
   - **Mostrar Lista (Popup)**: Abre un popup centrado con todos los enlaces
   - **Mostrar Sobre Enlaces**: Muestra tooltips encima de cada enlace
   - **Ocultar**: Cierra todas las vistas activas

### Vista de Lista (Popup)
- Popup centrado y elegante con scroll
- Cada enlace en una línea: número, texto, URL completa
- Botón individual para copiar cada enlace
- Botón superior para copiar TODOS los enlaces a la vez
- Cierra haciendo clic en la X o fuera del popup

### Vista Overlay
- Tooltip compacto en una línea sobre cada enlace
- Incluye: número, URL completa y botón de copiar
- Diseño optimizado que no interfiere con la navegación

## Arquitectura

- **manifest.json**: Configuración del plugin con rutas a la carpeta icons
- **popup.html/css**: Interfaz del popup de la extensión (separados)
- **popup.js**: Envía mensajes al content script
- **content.js**: Lógica principal que manipula la página
- **styles.css**: Estilos globales para los elementos inyectados en la página

## Notas

- El plugin funciona en todas las páginas web
- Los enlaces se extraen en tiempo real al activar el plugin
- Si la página carga más contenido dinámicamente, vuelve a activar el plugin


## Licencia

GNU GPLv3