# MoneyPilot AI

Aplicación financiera personal, mobile-first y sin backend. Los registros se guardan en IndexedDB en el dispositivo; la primera apertura carga datos de demostración para mostrar el dashboard.

## Requisitos

- Node.js 20 o posterior
- npm

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para validar el proyecto:

```bash
npm run lint
npm run build
```

## Funcionalidades

- Dashboard con saldo, ingresos, gastos, suscripciones, metas, préstamos y patrimonio.
- Crear, consultar, editar y eliminar registros financieros.
- Calendario financiero con vistas de día, semana y mes.
- Informes, resumen de patrimonio e insights locales.
- Importación y exportación de copias de seguridad JSON.
- Manifiesto PWA y service worker con fallback de navegación sin conexión.
- Interfaz en español y moneda USD.

El asistente calcula sus indicadores en el dispositivo con reglas locales; no envía información a un servicio de IA. El calendario y los datos financieros tampoco requieren API.
La serie histórica del gráfico de saldo y el desglose visual por categoría son datos de demostración; para informes históricos reales hace falta guardar snapshots financieros.

## Organización

```text
src/
  app/                  Rutas App Router, layout y estilos globales
  components/finance/   Gráficos y calendario
  features/finance/     Estado y operaciones de finanzas con Zustand
  lib/                  Dexie e internacionalización/formato
  types/                Modelos compartidos
public/
  manifest.webmanifest  Metadatos de instalación PWA
  sw.js                 Caché del shell y fallback offline
```

Dexie define la base local `money-pilot-ai`. El store hidrata el dashboard al abrir la app y escribe los cambios en IndexedDB. El JSON de respaldo usa la versión de esquema `1`; al importarlo se valida antes de sustituir los registros locales.

La interfaz y los tipos están separados de la persistencia para permitir incorporar un servicio API en el futuro sin mover las vistas a lógica de base de datos. Las llamadas de IA en servidor, sincronización entre dispositivos, divisas configurables y métricas históricas basadas en snapshots quedan para una siguiente etapa.

## Tema

La app arranca en **modo claro** (glassmorphism) y permite cambiar a oscuro con el bot�n de la barra superior. La transici�n usa View Transitions API (revelado circular) con respaldo suave, y la preferencia se guarda en localStorage.
