# Punto G (Windows)

## Crear el instalador .exe
1. Instala Node.js (versión LTS) desde https://nodejs.org
2. Descomprime esta carpeta. En el Explorador, entra en ella, escribe `cmd` en la barra de direcciones y pulsa Enter.
3. Ejecuta `npm install` (tarda unos minutos: descarga Electron).
4. Para probar la app sin instalar: `npm start`
5. Para generar el instalador: `npm run dist`
   Lo encontrarás en `dist\Punto G Setup 1.0.0.exe`.

## Notas
- Windows mostrará «editor desconocido» (SmartScreen) porque el instalador no está firmado: pulsa «Más información» y «Ejecutar de todas formas».
- Si `npm run dist` falla con «Cannot create symbolic link», abre el terminal como administrador o activa el Modo desarrollador de Windows (Configuración > Sistema > Para programadores) y repítelo.
- Los proyectos se guardan como archivos `.guion` (JSON). Si tenías una copia de seguridad de la versión web, pega su texto en un archivo `.json` y ábrelo con Archivo > Abrir.
- La app sigue guardando un borrador local además del archivo, por si algo falla.
