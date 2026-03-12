// ============================================================
// canvas.config.ts
// Configuración centralizada de recursos del canvas.
// En desarrollo los archivos están en /assets/
// En producción apuntan al filesystem externo (cambiar BASE_URL)
// ============================================================

export const CANVAS_CONFIG = {

  // Base URL de los assets. En producción reemplazar por la URL del filesystem.
  // Ejemplo producción: 'https://storage.empresa.com/siniestros/'
  ASSETS_BASE_URL: 'assets/',

  // Dimensiones lógicas del canvas (resolución interna, independiente del viewport)
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,

  // Fondos disponibles. Agregar/quitar entradas según los archivos en el filesystem.
  BACKGROUNDS: [
    { file: 'foto1.jpg', label: 'Cruce simple' },
    { file: 'foto2.jpg', label: 'Diagonal' },
    { file: 'foto3.jpg', label: 'Rotonda' },
  ],

  // Iconos del sidebar izquierdo.
  LEFT_ICONS: [
    { file: 'icono1.png', label: 'Auto' },
    { file: 'icono2.png', label: 'Moto' },
  ],

  // Iconos del sidebar derecho.
  RIGHT_ICONS: [
    { file: 'icono3.png', label: 'Camión' },
    { file: 'icono4.png', label: 'Peatón' },
  ],

} as const;

// Tipos explícitos (no derivados de un array específico para evitar tipos literales estrictos)
export interface BackgroundOption {
  file: string;
  label: string;
}

export interface IconOption {
  file: string;
  label: string;
}
