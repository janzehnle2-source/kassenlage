/* Setzt Hell oder Dunkel, bevor die Seite erscheint. Die Wahl steht in den Einstellungen. */
(function () {
  try {
    var t = window.localStorage.getItem('kassenlage-thema');
    if (t === 'hell') document.documentElement.setAttribute('data-theme', 'light');
    else if (t === 'dunkel') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) { /* ohne Speicher gilt die Einstellung des Geräts */ }
})();
