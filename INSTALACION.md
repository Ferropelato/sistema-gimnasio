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
1. Subí el proyecto a un hosting (Veercel, Netlify, etc.)
2. En el celular, abrí la URL en Chrome
3. En el menú (⋮) → "Agregar a la pantalla de inicio" o "Instalar app"
4. Queda como una app instalada

### Opción 3: Build y servidor local
1. `npm run build`
2. Usá un servidor que sirva la carpeta `dist` (ej: `npx serve dist`)
3. En el celular, conectado a la misma red, abrí la IP mostrada

## Cuotas: mes adeudado vs período de caja

Si un socio paga hoy una **deuda del mes pasado**, podés poner la **fecha del pago** en ese mes y, en **Imputar a recaudación del período**, elegir el **período actual**. Así el movimiento aparece en el resumen de este mes (Finanzas, liquidación en Profesores) aunque la fecha sea anterior. Si ya cargaste el pago sin eso, abrilo con ✏️ y asigná el período de recaudación.

## Datos (Firebase Realtime Database)

- Los datos se guardan en **Firebase** y se sincronizan entre todas las PCs/dispositivos
- **Barra bajo el menú (verde / amarillo / rojo):** indica si lo que hacés **llegó a la nube**. En la **PC del gimnasio**, antes de cerrar, comprobá **Nube OK** en verde; si está en rojo o amarillo, tocá **Subir / reconectar** o **💾 Guardar** hasta que pase a verde (y revisá WiFi o reglas de Firebase).
- Al guardar, la app **reintenta varias veces** si la red falla. Si volvés el WiFi, al recuperar conexión intenta subir solo.
- Al abrir la app, si Firebase responde, **prevalece lo que está en la nube** (así otra PC no “pisa” con un caché viejo del navegador). Si en una PC cargás socios y en otra no aparecen, revisá la consola del navegador (F12): suele ser fallo de red o reglas de Firebase al guardar.
- **Respaldo local**: siempre se guarda primero en localStorage; si la app se cierra o hay fallos de red, los datos se recuperan al volver a abrir en **ese mismo navegador**
- **Autoguardado por inactividad**: tras **5 minutos** sin escribir, hacer clic, desplazarse ni tocar la pantalla, se hace un respaldo local (no interrumpe lo que estés escribiendo)
- **Exportar**: descargá un backup JSON (botón 📤) para guardarlo en tu PC
- **Importar**: restauramos desde un archivo JSON (botón 📥)

### Si se pierden datos o al actualizar la app
- **Subir el código** (push a GitHub / deploy en Vercel) **no borra** los datos: viven en **Firebase**, no en el repositorio.
- Al abrir la app, si Firebase responde, se muestra lo que está en la **nube**. Si en una sesión cargaste socios o ventas pero **no se llegó a sincronizar** (fallo de red o reglas), eso puede haber quedado solo en **localStorage de ese navegador**. En ese caso, **recargar o actualizar la app puede hacer que desaparezca** esa copia local al reemplazarla por la nube.
- **Antes de recargar** si cargaste datos hoy y no estás seguro de que se hayan subido: usá **Exportar** (📤), guardá el JSON, y revisá en otra pestaña o PC si esos datos ya están en Firebase.
- Si tenés un backup exportado, usá **Importar** (📥) para fusionar o restaurar (reemplaza todo el estado con el archivo).

### Reglas de Firebase Realtime Database

En Firebase Console → Realtime Database → Reglas, usá:

```json
{
  "rules": {
    "gym": {
      ".read": true,
      ".write": true
    }
  }
}
```

Para producción, considerá restringir con autenticación.

## Deploy (Vercel + GitHub)

El proyecto está en **GitHub** (sistema-gimnasio) y **Vercel** hace deploy automático al hacer push.

**Para actualizar:**
```bash
git add .
git commit -m "Descripción del cambio"
git push origin main
```
Vercel detecta el push y redeploya en ~1 min.

**Link:** [sistema-gimnasio](https://vercel.com/fernando-ropelatos-projects/sistema-gimnasio) → en Domains verás la URL (ej: `sistema-gimnasio.vercel.app`).

**Firebase:** Agregá el dominio de Vercel en Firebase Console → Configuración → Dominios autorizados (ej: `*.vercel.app`).

## Lector de huella R307/R503

**Requisitos:** Chrome, HTTPS o localhost, lector conectado por USB.

1. **Registrar huella:** Socios → botón 👆 en el socio → Conectar lector → Registrar (2 pasos). Apoyá el dedo 2 veces; si coinciden, se guarda.
2. **Verificar acceso:** Acceso Huella → Conectar lector → escaneá la huella. Se muestra el semáforo (verde/amarillo/rojo).
3. **Modo teclado:** Si el lector emula teclado y envía el ID al escanear, escribí el ID en el campo de búsqueda o escaneá directo.

## Contraseña Finanzas

Por defecto: `admin`. Cambiala en Configuración.
