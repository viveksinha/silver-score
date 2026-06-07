/* Silver Score — pageviews.js
 * GoatCounter: each full page load = one pageview (not unique visitors).
 * Footer shows site-wide TOTAL when available; removes the slot on any failure.
 */
(function () {
  var GC_CODE = 'vivek-silver-score';
  var GC_ORIGIN = 'https://' + GC_CODE + '.goatcounter.com';
  var FETCH_TIMEOUT_MS = 8000;

  var beacon = document.createElement('script');
  beacon.async = true;
  beacon.src = '//gc.zgo.at/count.js';
  beacon.setAttribute('data-goatcounter', GC_ORIGIN + '/count');
  document.head.appendChild(beacon);

  function removeCounter(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showTotal() {
    var el = document.getElementById('footer-visit-count');
    if (!el) return;

    var settled = false;

    function fail() {
      if (settled) return;
      settled = true;
      removeCounter(el);
    }

    var req = new XMLHttpRequest();
    req.addEventListener('load', function () {
      if (settled) return;
      if (req.status !== 200) {
        fail();
        return;
      }
      try {
        var data = JSON.parse(req.responseText);
        var count = data && data.count;
        if (count == null || count === '') {
          fail();
          return;
        }
        settled = true;
        el.textContent = count + ' page views';
      } catch (e) {
        fail();
      }
    });
    req.addEventListener('error', fail);
    req.addEventListener('timeout', fail);
    req.open('GET', GC_ORIGIN + '/counter/TOTAL.json');
    req.timeout = FETCH_TIMEOUT_MS;
    req.send();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showTotal);
  } else {
    showTotal();
  }
})();
