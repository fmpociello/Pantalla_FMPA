# Pantalla - FMPA · web (v7)

Sitio estático: no necesita instalar nada ni compilar. Lee todo de Supabase con la clave pública (solo lectura).

## Archivos
- `index.html` — estructura de las 4 pestañas.
- `css/style.css` — diseño.
- `js/config.js` — dirección de Supabase, clave pública, frecuencia de actualización y texto del disclaimer.
- `js/calc.js` — todas las fórmulas (MEP, CCL, canjes, TNA, TEM, ratio de ley...).
- `js/api.js` — lectura de Supabase.
- `js/app.js` — dibuja las tablas y los gráficos.

## Cómo publicarlo en Netlify
- **Arrastrando:** Netlify → tu sitio → pestaña *Deploys* → arrastrá la carpeta descomprimida (o este zip) a la zona de "drag and drop".
- **Con GitHub:** subí estos archivos a un repositorio (puede ser privado) y conectalo a Netlify; cada cambio se publica solo.

## Para editar
- Texto del disclaimer, frecuencia de lectura o clave: `js/config.js`.
- **Nunca** pegar en esta carpeta la clave secreta (`sb_secret_...`) ni la `service_role`. Solo va la `sb_publishable_...`.
