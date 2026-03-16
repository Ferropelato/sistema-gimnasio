# Center Gym - Cómo instalar y usar

## Ubicación del proyecto

El proyecto está en:
```
c:\Users\Fernando\Desktop\curso desarrollador\gimnasio
```

## En la PC (desarrollo)

1. Abrí una terminal en esa carpeta
2. Ejecutá: `npm install` (solo la primera vez)
3. Ejecutá: `npm run dev`
4. Se abre en http://localhost:3000

## Para instalar en una PC (producción)

1. Ejecutá: `npm run build`
2. Se genera la carpeta `dist/` con los archivos listos
3. Opciones para usarlo:
   - **Opción A**: Copiá la carpeta `dist` a donde quieras y abrí `dist/index.html` con un navegador (puede haber limitaciones con rutas)
   - **Opción B**: Usá un servidor local como [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) en VS Code apuntando a `dist`
   - **Opción C**: Subir a un hosting gratuito (Vercel, Netlify, GitHub Pages) para tener una URL

## En el celular

### Opción 1: Misma red (WiFi)
1. En la PC: `npm run dev`
2. En la PC, averiguá tu IP local (ej: `ipconfig` en Windows, buscá "IPv4")
3. En el celular, conectado al mismo WiFi, abrí: `http://TU_IP:3000` (ej: http://192.168.1.10:3000)

### Opción 2: PWA (Progressive Web App)
1. Subí el proyecto a un hosting (Vercel, Netlify, etc.)
2. En el celular, abrí la URL en Chrome
3. En el menú (⋮) → "Agregar a la pantalla de inicio" o "Instalar app"
4. Queda como una app instalada

### Opción 3: Build y servidor local
1. `npm run build`
2. Usá un servidor que sirva la carpeta `dist` (ej: `npx serve dist`)
3. En el celular, conectado a la misma red, abrí la IP mostrada

## Datos

- Los datos se guardan en **localStorage** del navegador y persisten al cerrar
- **Exportar**: descargá un backup JSON (botón 📤) para guardarlo en tu PC
- **Importar**: restauramos desde un archivo JSON (botón 📥) si borraste caché o cambiás de dispositivo
- **Recomendación**: exportá un backup cada semana o antes de limpiar el navegador

## Contraseña Finanzas

Por defecto: `admin`. Cambiala en Configuración.
