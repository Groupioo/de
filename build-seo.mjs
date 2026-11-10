// build-seo.mjs — Node 18+, sin dependencias.
// Uso (en la carpeta raíz del sitio, donde está index.html):
//   node build-seo.mjs              -> lee los grupos aprobados de Firestore
//   node build-seo.mjs --mock g.json -> usa un JSON local (para probar)
// Genera:
//   /<kategorie>/index.html        (copia de la app con título/canonical propios + enlaces a los grupos)
//   /grupo/<slug>-<id>/index.html  (página ligera y limpia por grupo)
//   /index.html                    (solo reescribe el bloque entre <!--GL-SEO-START--> y <!--GL-SEO-END-->)
//   /sitemap.xml
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const SITE = 'https://gruppenlink.de';
const PROJECT = 'groupio-58815';
const API_KEY = 'AIzaSyBp6Irj2Bvrdph0KuGpgf2AEXdR0LL6tXE';
const CATEGORIES = ['Allgemein', 'Gaming', 'Fan Gruppen', 'Flohmarkt', 'Musik', 'Selbsthilfe', 'Serien & Filme', 'Freundschaft', 'Adult', 'Finanzen', 'Anime & Manga'];
const ADULT = ['Adult'];

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60).replace(/-$/, '');
const catSlug = c => c.toLowerCase().replace(/&/g, ' ').trim().replace(/\s+/g, '-'); // igual que glCatSlug en index.html
const title = g => g.name || (g.tags ? g.tags.split(' ')[0] : (g.category || 'WhatsApp Gruppe'));
const gPath = g => `/grupo/${slug(title(g)) || 'gruppe'}-${g.id}/`;

// ---------- Datos ----------
function val(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  return undefined;
}
async function loadGroups() {
  const i = process.argv.indexOf('--mock');
  if (i > -1) return JSON.parse(readFileSync(process.argv[i + 1], 'utf8'));
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${API_KEY}`;
  const body = { structuredQuery: { from: [{ collectionId: 'groups' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }, limit: 10000 } };
  // Tus reglas exigen request.auth != null -> login anónimo (el mismo que usa la app)
  const au = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  if (!au.ok) throw new Error('Login anónimo falló: ' + au.status + ' ' + await au.text());
  const { idToken } = await au.json();
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Firestore: ' + r.status + ' ' + await r.text());
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => {
    const o = { id: x.document.name.split('/').pop() };
    for (const [k, v] of Object.entries(x.document.fields || {})) o[k] = val(v);
    return o;
  });
}

// ---------- Plantillas ----------
const block = (h2, links) => `<!--GL-SEO-START--><section style="max-width:72rem;margin:2rem auto;padding:1rem;font:14px/1.7 system-ui,sans-serif"><h2 style="font-size:1.1rem;font-weight:700">${esc(h2)}</h2><ul style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.4rem 1.2rem">${links.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul></section><!--GL-SEO-END-->`;
const catLinks = CATEGORIES.map(c => ['/' + catSlug(c) + '/', c + ' WhatsApp-Gruppen']);

function groupPage(g, same) {
  const t = title(g), cat = g.category || 'Allgemein', url = SITE + gPath(g);
  const ttl = `${t} – WhatsApp-Gruppe (${cat}) | GruppenLink`;
  const desc = clip(`${t} – WhatsApp-Gruppe in der Kategorie ${cat}. ${g.description || g.tags || ''} Jetzt kostenlos beitreten auf GruppenLink.`, 158);
  const img = /^https?:\/\//.test(g.image || '') && g.image.length < 500 ? g.image : '';
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url, url, name: ttl, description: desc, inLanguage: 'de', isPartOf: { '@id': SITE + '/#website' } },
    { '@type': 'BreadcrumbList', itemListElement: [['GruppenLink', SITE + '/'], [cat, `${SITE}/${catSlug(cat)}/`], [t, url]].map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x[0], item: x[1] })) } ] };
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ttl)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
${ADULT.includes(cat) ? '<meta name="rating" content="adult">' : ''}<meta property="og:type" content="website"><meta property="og:title" content="${esc(ttl)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(img || SITE + '/apple-touch-icon.png')}">
<link rel="icon" href="/favicon-16.png"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;margin:0}main{max-width:44rem;margin:0 auto;padding:1.5rem 1rem}.c{background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:1.5rem}a{color:#006b53}.b{display:inline-block;background:#25d366;color:#fff!important;font-weight:700;padding:.8rem 1.4rem;border-radius:.8rem;text-decoration:none;margin:1rem 0}img{width:96px;height:96px;border-radius:1rem;object-fit:cover}ul{padding-left:1.1rem}</style></head><body><main>
<nav aria-label="Breadcrumb" style="font-size:.85rem;margin-bottom:1rem"><a href="/">GruppenLink</a> › <a href="/${catSlug(cat)}/">${esc(cat)}</a> › ${esc(t)}</nav>
<div class="c">${img ? `<img src="${esc(img)}" alt="${esc(t)}" width="96" height="96">` : ''}<h1>${esc(t)}</h1><p><strong>Kategorie:</strong> <a href="/${catSlug(cat)}/">${esc(cat)}</a></p>
<p>${esc(g.description || '')} ${esc(g.tags || '')}</p><a class="b" href="/?grupo=${encodeURIComponent(g.id)}" rel="nofollow">Gruppe öffnen &amp; beitreten</a>
<p style="font-size:.85rem;color:#475569">Kostenlos und ohne Anmeldung. Gruppenlinks werden von Nutzern eingereicht.</p></div>
${same.length ? `<h2 style="font-size:1.05rem;margin-top:2rem">Weitere ${esc(cat)}-Gruppen</h2><ul>${same.map(x => `<li><a href="${gPath(x)}">${esc(title(x))}</a></li>`).join('')}</ul>` : ''}
<p><a href="/">← Alle WhatsApp-Gruppen auf GruppenLink</a></p></main></body></html>`;
}

// ---------- Build ----------
const groups = (await loadGroups()).filter(g => g.id && g.linkExpired !== true && g.status !== 'rejected');
const today = new Date().toISOString().slice(0, 10);
const tpl = readFileSync('index.html', 'utf8');
if (!tpl.includes('<!--GL-SEO-START-->')) throw new Error('Falta el marcador <!--GL-SEO-START--> en index.html (usa el index.html parcheado).');
const inject = (html, b) => html.replace(/<!--GL-SEO-START-->[\s\S]*?<!--GL-SEO-END-->/, () => b);
const write = (p, c) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); };
const byCat = c => groups.filter(g => (g.category || 'Allgemein') === c);

// Startseite: bloque con categorías + últimas gruppen (sin Adult)
const latest = groups.filter(g => !ADULT.includes(g.category)).sort((a, b) => String(b.approvedAt || b.submittedAt || '').localeCompare(String(a.approvedAt || a.submittedAt || ''))).slice(0, 60);
write('index.html', inject(tpl, block('Kategorien & neueste WhatsApp-Gruppen', [...catLinks, ...latest.map(g => [gPath(g), title(g)])])));

// Categorías
for (const c of CATEGORIES) {
  const list = byCat(c), n = list.length, url = `${SITE}/${catSlug(c)}/`;
  const ttl = `${c} WhatsApp-Gruppen${n ? ` (${n})` : ''} – kostenlos beitreten | GruppenLink`;
  const desc = `${c} WhatsApp-Gruppen: ${n ? n + ' aktive Gruppen' : 'Gruppen'} entdecken und per Link kostenlos beitreten. Gruppen aus DE, AT & CH – täglich aktualisiert auf GruppenLink.`;
  let h = inject(tpl, block(`${c} WhatsApp-Gruppen`, [...list.map(g => [gPath(g), title(g)]), ...catLinks]))
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(ttl)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + esc(desc) + b)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + url + b)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + url + b)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => a + esc(ttl) + b)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => a + esc(desc) + b);
  if (ADULT.includes(c)) h = h.replace('</head>', '<meta name="rating" content="adult"></head>');
  write(`${catSlug(c)}/index.html`, h);
}

// Gruppen
for (const g of groups) write(gPath(g).slice(1) + 'index.html', groupPage(g, byCat(g.category || 'Allgemein').filter(x => x.id !== g.id).slice(0, 8)));

// Sitemap (solo URLs que existen y devuelven 200)
const urls = [[SITE + '/', today, '1.0'], ...CATEGORIES.map(c => [`${SITE}/${catSlug(c)}/`, today, '0.8']),
  ...groups.map(g => [SITE + gPath(g), String(g.approvedAt || g.submittedAt || today).slice(0, 10), '0.6'])];
for (const p of ['impressum', 'datenschutz']) if (existsSync(p + '.html') || existsSync(p + '/index.html')) urls.push([`${SITE}/${p}`, today, '0.3']);
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([l, d, p]) => `  <url><loc>${esc(l)}</loc><lastmod>${d}</lastmod><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`);
console.log(`OK: ${groups.length} grupos, ${CATEGORIES.length} categorías, ${urls.length} URLs en sitemap.xml`);
