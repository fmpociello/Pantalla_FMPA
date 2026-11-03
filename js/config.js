// Configuración de la web. La clave "publishable" es pública por diseño:
// la seguridad la dan las reglas de la base (solo lectura). NUNCA pegar acá la clave secreta.
window.CPQ_CONFIG = {
  SUPABASE_URL: 'https://zimagaomozqyziluslnl.supabase.co',
  SUPABASE_KEY: 'sb_publishable_k-Zesn5b9hZ5gvdgvpUerw_OiU2uuJq',
  REFRESH_MS: 30000, // la web vuelve a leer Supabase cada 30 segundos
  OFFICIAL_CODE: 'REF', // código del BCRA que se muestra como "Dólar oficial mayorista (A3500)"
  DISCLAIMER:
    'Elaborado por FMPA como proyecto personal, sin vínculo con ninguna entidad financiera ni empleador. Esta pantalla se elabora con información de acceso público ' +
    '(data912, BCRA y otras fuentes), sin verificación independiente, y no existe obligación de actualizarla; puede modificarse o dejar de funcionar sin previo aviso. ' +
    'Los datos pueden contener demoras, errores u omisiones, y los precios son de referencia y no ejecutables. Los cálculos (TIR, TNA, TEM, canjes, brechas, duration y ' +
    'proyecciones de CER) son estimaciones que dependen de supuestos, como la liquidación T+1, la comisión elegida y la proyección de inflación del REM, y pueden diferir ' +
    'de los resultados reales. Nada de lo aquí contenido constituye una oferta, una recomendación ni un compromiso, pasado, presente o futuro, ni asesoramiento legal, ' +
    'impositivo o de inversión. Los rendimientos pasados no garantizan resultados futuros. El autor no será responsable de las conclusiones, interpretaciones, cálculos o ' +
    'decisiones que se tomen a partir de su contenido, y el usuario asume el riesgo de su utilización. Antes de operar, se recomienda verificar los datos con su agente y ' +
    'consultar a sus asesores legales y/o financieros.'
};
