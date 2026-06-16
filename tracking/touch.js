/**
 * Altorancho Multi-Touch Attribution Tracker v1
 *
 * Instalación en Tienda Nube:
 * Admin → Personalización → Scripts/HTML personalizado → agregar al <head>
 *
 * Cambiar las dos constantes según la tienda donde se instala:
 *   API_URL → URL del deploy en Railway (ej. https://xxx.railway.app/api/touch)
 *   STORE   → 'minorista' o 'mayorista'
 */
(function () {
  'use strict';

  var API_URL = 'https://TU-API.railway.app/api/touch'; // ← cambiar por URL de Railway
  var STORE = 'minorista'; // ← cambiar a 'mayorista' en la otra tienda
  var VISITOR_KEY = 'at_vid';
  var SESSION_KEY = 'at_session';

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getOrCreateVisitorId() {
    var id = null;

    try {
      id = localStorage.getItem(VISITOR_KEY);
    } catch (e) {}

    // Fallback a cookie si localStorage no está disponible
    if (!id) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + VISITOR_KEY + '=([^;]*)'));
      if (match) id = decodeURIComponent(match[1]);
    }

    if (!id) {
      id = generateUUID();
      try {
        localStorage.setItem(VISITOR_KEY, id);
      } catch (e) {}
      var expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie =
        VISITOR_KEY + '=' + encodeURIComponent(id) +
        '; expires=' + expires.toUTCString() +
        '; path=/; SameSite=Lax';
    }

    return id;
  }

  function isNewSession() {
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1');
        return true;
      }
      return false;
    } catch (e) {
      return true; // sessionStorage no disponible → asumir nueva sesión
    }
  }

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || undefined;
    } catch (e) {
      return undefined;
    }
  }

  function sendTouch(visitorId, params) {
    var payload = {
      visitor_id: visitorId,
      store: STORE,
      page_url: window.location.href,
      utm_source: params.utm_source,
      utm_medium: params.utm_medium,
      utm_campaign: params.utm_campaign,
      utm_content: params.utm_content,
      utm_term: params.utm_term,
      fbclid: params.fbclid,
      gclid: params.gclid,
      ttclid: params.ttclid,
      epik: params.epik,
      referrer: params.referrer,
    };

    var body = JSON.stringify(payload);

    if (typeof navigator.sendBeacon === 'function') {
      // Blob con application/json para que Express lo parsee correctamente
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(API_URL, blob);
    } else {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // Registrar toque solo si hay señal de canal pagado O si es inicio de sesión nueva
  var hasPaidSignal =
    getParam('fbclid') ||
    getParam('gclid') ||
    getParam('ttclid') ||
    getParam('epik') ||
    getParam('utm_source');

  if (!hasPaidSignal && !isNewSession()) {
    return;
  }

  var params = {
    utm_source: getParam('utm_source'),
    utm_medium: getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    utm_content: getParam('utm_content'),
    utm_term: getParam('utm_term'),
    fbclid: getParam('fbclid'),
    gclid: getParam('gclid'),
    ttclid: getParam('ttclid'),
    epik: getParam('epik'),
    referrer: document.referrer || undefined,
  };

  sendTouch(getOrCreateVisitorId(), params);
})();
