/**
 * Silver Score — append sorted lists in batches when a sentinel intersects.
 * For tables inside .table-scroll, pass root: table.closest('.table-scroll') so
 * loading triggers when the user reaches the bottom of the scroll area.
 */
(function (global) {
  'use strict';

  function createInfiniteScroll(opts) {
    var pageSize = opts.pageSize;
    var getItems = opts.getItems;
    var anchorAfter = opts.anchorAfter;
    var root = opts.root != null ? opts.root : null;
    var render = opts.render;

    var shown = 0;
    var observer = null;
    var loading = false;
    var sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');

    function teardown() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (sentinel.parentNode) sentinel.remove();
      loading = false;
    }

    function appendBatch() {
      var items = getItems();
      if (loading || shown >= items.length) return;
      loading = true;
      var end = Math.min(shown + pageSize, items.length);
      var slice = items.slice(shown, end);
      render(slice, { append: shown > 0, startIndex: shown });
      shown = end;
      loading = false;
      if (shown >= items.length) teardown();
    }

    function reset() {
      teardown();
      shown = 0;
      var items = getItems();
      if (!items.length) {
        render([], { append: false, startIndex: 0 });
        return;
      }
      var first = Math.min(pageSize, items.length);
      render(items.slice(0, first), { append: false, startIndex: 0 });
      shown = first;
      if (shown >= items.length) return;
      if (!anchorAfter || !anchorAfter.parentNode) return;

      anchorAfter.insertAdjacentElement('afterend', sentinel);

      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting && e.target === sentinel) appendBatch();
          });
        },
        { root: root, rootMargin: '240px', threshold: 0 }
      );
      observer.observe(sentinel);
    }

    return { reset: reset, teardown: teardown };
  }

  global.createSilverScoreInfiniteScroll = createInfiniteScroll;
})(typeof window !== 'undefined' ? window : globalThis);
