import fs from 'fs';
import path from 'path';

// Dominio principal
const BASE_URL = 'https://gruppenlink.de';

// Rutas estáticas de la web
const staticPages = [
  '',
  '/impressum',
  '/datenschutz',
  '/categories',
  '/whatsapp',
  '/telegram'
];

async function generateSitemap() {
  console.log('Generando sitemap.xml...');

  const urls = [...staticPages];

  // Generar contenido XML
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => {
    return `  <url>
    <loc>${BASE_URL}${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${url === '' ? '1.0' : '0.8'}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  // Determinar la ruta de salida (sitemap.xml en la raíz)
  const outputPath = path.resolve(process.argv[2] || 'sitemap.xml');
  fs.writeFileSync(outputPath, sitemapXml, 'utf8');

  console.log(`¡Sitemap generado exitosamente en ${outputPath}!`);
}

generateSitemap().catch((err) => {
  console.error('Error al generar el sitemap:', err);
  process.exit(1);
});
