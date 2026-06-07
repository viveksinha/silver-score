/* Silver Score — pageviews.js
 * GoatCounter: each full page load = one pageview (not unique visitors).
 * Footer shows site-wide TOTAL. In GoatCounter site settings, enable
 * “Allow adding visitor counts on your website”.
 */
(function () {
  var GC_CODE = 'vivek-silver-score';
  var GC_ORIGIN = 'https://' + GC_CODE + '.goatcounter.com';

  var beacon = document.createElement('script');
  beacon.async = true;
  beacon.src = '//gc.zgo.at/count.js';
  beacon.setAttribute('data-goatcounter', GC_ORIGIN + '/count');
  document.head.appendChild(beacon);

  function showTotal() {
    var el = document.getElementById('footer-visit-count');
    if (!el) return;

    var req = new XMLHttpRequest();
    req.addEventListener('load', function () {
      if (req.status !== 200) return;
      try {
        var data = JSON.parse(req.responseText);
        if (data && data.count) {
          el.textContent = data.count + ' page views';
        }
      } catch (e) { /* ignore */ }
    });
    req.open('GET', GC_ORIGIN + '/counter/TOTAL.json');
    req.send();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showTotal);
  } else {
    showTotal();
  }
})();
