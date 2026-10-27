// Configuración de la web. La clave "publishable" es pública por diseño:
// la seguridad la dan las reglas de la base (solo lectura). NUNCA pegar acá la clave secreta.
window.CPQ_CONFIG = {
  SUPABASE_URL: 'https://zimagaomozqyziluslnl.supabase.co',
  SUPABASE_KEY: 'sb_publishable_k-Zesn5b9hZ5gvdgvpUerw_OiU2uuJq',
  REFRESH_MS: 30000, // la web vuelve a leer Supabase cada 30 segundos
  DISCLAIMER:
    'Herramienta de seguimiento con fines informativos. No constituye recomendación de inversión ni oferta de ' +
    'compra o venta de valores. Los datos provienen de fuentes públicas (data912, BCRA) y pueden tener demoras, ' +
    'faltantes o errores; no reemplazan las cotizaciones de tu agente. Rendimientos pasados no garantizan resultados futuros.'
};
