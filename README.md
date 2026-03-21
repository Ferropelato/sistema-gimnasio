# Center Gym - Sistema de Gestión

Sistema web para la gestión de un gimnasio. Incluye socios, cuotas, ventas, stock, actividades, rutinas, métricas, finanzas (acceso restringido) y simulador de acceso por huella.

## Inicio rápido

```bash
npm install
npm run
```

Se abrirá el navegador en `http://localhost:3000`

## Características

- **Dashboard**: Resumen de socios activos, por vencer, vencidos e ingresos
- **Socios**: Ficha completa (nombre, DNI, teléfono, email, dirección). Editar y enviar WhatsApp (por vencer, vencido, novedad)
- **Cuotas**: Registrar pagos y renovaciones. Podés poner la fecha del mes adeudado e **imputar la recaudación al período actual** (caja / liquidación al profe). Actualiza el estado del socio
- **Ventas**: Productos y bebidas. El stock se descuenta automáticamente
- **Stock**: Ver stock actual y agregar unidades
- **Actividades**: Musculación, CrossFit, Spinning, Funcional, Pase Diario, Mixto, Taekwondo, etc.
- **Profesores**: Cargar profesores y actividades. Tipos de pago: costo fijo, % salón, por clase. Liquidación automática al registrar cuotas
- **Rutinas**: Los profes cargan rutinas (un ejercicio por fila: nombre, series, reps, peso, descanso) y pueden imprimirlas
- **Métricas**: Alumnos activos por actividad
- **Finanzas** (🔒): Acceso con contraseña. Resumen por método de pago (efectivo, transferencia, etc.), liquidación profesores 15-15, pagos adelantados, mes a mes
- **Acceso Huella/DNI**: Buscá por nombre o DNI para ver el semáforo. Preparado para lector de huella USB
- **Config**: Período actual, tarifa luz
- **Autoguardado**: Al cerrar la pestaña, al cambiar de app, y cada 30 min cuando la pestaña está en segundo plano
- **Botón Guardar**: Guardado manual por si las dudas

## Semáforo

- **Verde**: Socio al día (pagó el período actual)
- **Amarillo**: Vence en los próximos 7 días
- **Rojo**: Vencido (debe regularizar)

## Acceso por DNI o huella

- **DNI**: En Acceso Huella, escribí el DNI del socio para ver si está al día. Agregá el DNI al cargar socios nuevos.
- **Lector de huella USB** (futuro): Conectar el lector, asociar cada huella a un socio, y al escanear mostrar el semáforo

## Implementaciones posibles

- **Exportar/Importar JSON**: Backup y restauración de datos
- **Impresión de cobros**: Lista de deudores para imprimir
- **Editar socios**: Modificar DNI, actividad, etc. de socios existentes
- **Gastos y luz**: Módulos para registrar egresos y lecturas de consumo
- **Liquidación profesores**: Cálculo automático del % por actividad
- **Reportes PDF**: Resumen mensual, ingresos por período
- **Asistencia**: Registro de quién asistió cada día
- **App móvil**: Versión PWA para usar en tablet en recepción

## Datos

Los datos se guardan en `localStorage` del navegador. Para cargar datos iniciales desde Excel, ejecutá el script Python en `scripts/export-excel.py` (requiere pandas y openpyxl).

## Recomendaciones

1. **Backup**: Exportar datos periódicamente (agregar botón "Exportar JSON")
2. **Impresión**: Agregar vista de cobros para imprimir
3. **Deudores**: Filtrar socios vencidos para seguimiento
4. **Liquidación profesores**: Calcular % por actividad según historial de cuotas
