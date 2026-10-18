/** Diccionarios ES/EN y utilidades de idioma (puras, testeables en Node). */

export const DEFAULT_LANG = 'es';
export const SUPPORTED = ['es', 'en'];

export function normalizeLang(code) {
  const c = String(code ?? '').toLowerCase().split('-')[0];
  return SUPPORTED.includes(c) ? c : DEFAULT_LANG;
}

export function t(dicts, lang, key, params) {
  const d = dicts[lang] ?? dicts[DEFAULT_LANG];
  let s = d?.[key];
  if (s === undefined) s = dicts[DEFAULT_LANG]?.[key];
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll('{' + k + '}', String(v));
  }
  return s;
}

/** Claves de `a` que faltan en `b` (y viceversa): la prueba exige simetría total ES↔EN. */
export function diffKeys(a, b) {
  const missing = Object.keys(a).filter((k) => !(k in b));
  const extra = Object.keys(b).filter((k) => !(k in a));
  return { missing, extra };
}

export function pickLang(userPref, browserLang) {
  const pref = normalizeLang(userPref);
  if (userPref === 'auto' || userPref === undefined || userPref === null) {
    return normalizeLang(browserLang);
  }
  return pref;
}
