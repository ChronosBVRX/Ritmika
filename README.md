# Rítmika

Plataforma de entretenimiento interactivo local (Party Game) del género de karaoke, diseñada bajo una arquitectura Dual-Display. El sistema ejecuta un servidor central local y una interfaz de visualización en la pantalla principal (TV), mientras que los participantes interactúan en tiempo real utilizando el navegador web de sus dispositivos móviles como controladores, sin necesidad de instalar aplicaciones dedicadas y con soporte para funcionamiento completamente offline.

## Características Principales

*   **Esquema Dual-Display:** Pantalla principal de juego (TV) sincronizada en tiempo real con las pantallas táctiles de los controladores móviles.
*   **Conectividad Local Directa:** Soporte para modo 100% offline mediante la inicialización de redes locales del sistema anfitrión, permitiendo jugar sin conexión a internet activa.
*   **Experiencia sin Fricción:** Acceso rápido para jugadores mediante el escaneo de códigos QR dinámicos generados en tiempo real por el servidor.
*   **Sistema de Presentador Animado:** Motor de interrupciones visuales en pantalla con múltiples estados de ánimo sincronizados con locuciones dinámicas.
*   **Diseño Neo-Brutalista:** Interfaz gráfica responsiva de alto contraste, bordes definidos y animaciones fluidas a nivel de cliente.
*   **Streaming Optimizado:** Proxy de transmisión de video local que resuelve la comunicación CORS y optimiza el almacenamiento dinámico (buffering) mediante peticiones por rangos HTTP.

## Arquitectura del Proyecto

El sistema se divide en tres componentes independientes:

1.  **Servidor Local (Node.js + Express + Socket.io):** Gestiona la entrega de recursos estáticos, la resolución de red local para códigos QR y la canalización de eventos mediante sockets bidireccionales de baja latencia.
2.  **Cliente Gráfico (HTML5 / Vanilla JS / CSS):**
    *   **Pantalla TV (`public/tv.html`):** Contiene la lógica central del estado del juego, renderizado de ruleta interactiva y flujo de reproducción.
    *   **Controlador Táctil (`public/mobile.html`):** Expone las interfaces dinámicas de selección de avatar, votación, reacciones y asignación de pistas.
3.  **Lanzador Nativo (C# WinForms / WebView2):** Controla el inicio del servidor en segundo plano, la reproducción inicial de audio de bajo nivel mediante APIs del sistema operativo (`winmm.dll`) y la apertura del cliente en modo pantalla completa dedicado.

## Estructura de Directorios

```
├── public/                 # Recursos web estáticos
│   ├── assets/             # Assets gráficos y de audio procesados
│   ├── js/                 # Lógica de animaciones y síntesis de sonido local
│   ├── libs/               # Dependencias de librerías locales para modo offline
│   ├── tv.html             # Interfaz de la pantalla principal (TV)
│   └── mobile.html         # Interfaz de controles móviles
├── server/                 # Lógica del servidor local
│   └── index.js            # Servidor Express, enrutador de Sockets y proxy HTTP
├── src/                    # Código fuente del lanzador nativo
│   ├── Launcher.cs         # Inicializador del sistema y reproductor de audio nativo
│   └── GameWindow.cs       # Ventana contenedora WebView2 para modo pantalla completa
├── scripts/                # Herramientas de automatización y compilación
├── build.bat               # Compilador en un paso de la aplicación ejecutable
└── package.json            # Configuración de dependencias de Node.js
```

## Requisitos del Sistema

*   **Sistema Operativo:** Windows 10 o superior (con Microsoft Edge WebView2 Runtime instalado).
*   **Entorno de Ejecución:** Node.js v16+ y gestor de paquetes npm.
*   **Compilador:** Herramienta csc.exe (.NET Framework 4.6.2+) disponible en la ruta del sistema para compilación del lanzador.

## Instrucciones de Construcción y Ejecución

1.  Instalar las dependencias de Node.js en el directorio raíz:
    ```bash
    npm install
    ```
2.  Configurar las variables de entorno creando un archivo `.env` en la raíz del proyecto con el siguiente formato:
    ```env
    PORT=3000
    HOTSPOT_SSID=NombreDeTuRed
    HOTSPOT_PASSWORD=ContraseñaDeTuRed
    ```
3.  Ejecutar el script de construcción local para descargar las bibliotecas nativas de WebView2, generar los iconos de la aplicación y compilar el binario ejecutable de Windows:
    ```cmd
    build.bat
    ```
4.  Iniciar la aplicación ejecutando el archivo compilado generado:
    ```cmd
    Ritmika.exe
    ```
