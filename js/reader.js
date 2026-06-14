(function () {
  'use strict';

  var STORAGE_KEY = 'mq-progress';
  var FONT_KEY = 'mq-font-size';
  var TOTAL_CHAPTERS = 48;

  function getProgress() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      var p = data ? JSON.parse(data) : {};
      if (!p.chaptersRead) p.chaptersRead = [];
      if (!p.bookmarks) p.bookmarks = [];
      if (!p.scrollPositions) p.scrollPositions = {};
      return p;
    } catch (e) {
      return { currentChapter: null, chaptersRead: [], bookmarks: [], scrollPositions: {} };
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {}
  }

  var chapterEl = document.querySelector('[data-chapter]');
  var chapterNum = chapterEl ? parseInt(chapterEl.getAttribute('data-chapter'), 10) : null;

  // ---- Track current chapter & restore scroll position ----
  if (chapterNum) {
    var progress = getProgress();

    if (progress.currentChapter && progress.currentChapter !== chapterNum) {
      if (progress.chaptersRead.indexOf(progress.currentChapter) === -1) {
        progress.chaptersRead.push(progress.currentChapter);
      }
    }
    progress.currentChapter = chapterNum;
    saveProgress(progress);

    var savedScroll = progress.scrollPositions[chapterNum];
    if (savedScroll && savedScroll > 0) {
      requestAnimationFrame(function () {
        var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        window.scrollTo(0, savedScroll * docHeight);
      });
    } else {
      window.scrollTo(0, 0);
    }
  }

  // ---- Auto-save scroll position (throttled) ----
  if (chapterNum) {
    var scrollSaveTimer = null;
    window.addEventListener('scroll', function () {
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(function () {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var pct = docHeight > 0 ? scrollTop / docHeight : 0;
        var p = getProgress();
        p.scrollPositions[chapterNum] = Math.round(pct * 10000) / 10000;
        saveProgress(p);
      }, 300);
    });
  }

  // ---- Scroll progress bar ----
  var progressBar = document.getElementById('reading-progress-bar');
  if (progressBar) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          progressBar.style.width = Math.min(pct, 100) + '%';
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ---- Bookmark button ----
  var bookmarkBtn = document.getElementById('bookmark-toggle');
  if (bookmarkBtn && chapterNum) {
    var p = getProgress();
    var isBookmarked = p.bookmarks.indexOf(chapterNum) !== -1;
    updateBookmarkUI(isBookmarked);

    bookmarkBtn.addEventListener('click', function () {
      var prog = getProgress();
      var idx = prog.bookmarks.indexOf(chapterNum);
      if (idx !== -1) {
        prog.bookmarks.splice(idx, 1);
        isBookmarked = false;
      } else {
        prog.bookmarks.push(chapterNum);
        prog.bookmarks.sort(function (a, b) { return a - b; });
        isBookmarked = true;
      }
      saveProgress(prog);
      updateBookmarkUI(isBookmarked);
    });
  }

  function updateBookmarkUI(active) {
    if (!bookmarkBtn) return;
    bookmarkBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    bookmarkBtn.classList.toggle('bookmarked', active);
    bookmarkBtn.title = active ? 'Remove bookmark' : 'Bookmark this chapter';
  }

  // ---- Keyboard navigation ----
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft') {
      var prev = document.querySelector('.nav-prev:not(.hidden)');
      if (prev && prev.href) window.location.href = prev.href;
    } else if (e.key === 'ArrowRight') {
      var next = document.querySelector('.nav-next:not(.hidden)');
      if (next && next.href) window.location.href = next.href;
    }
  });

  // ---- Font size toggle ----
  var fontSizes = ['', 'font-sm', 'font-lg'];
  var fontLabels = ['Aa', 'A', 'A+'];
  var toggleBtn = document.getElementById('font-size-toggle');

  if (toggleBtn) {
    var currentIdx = fontSizes.indexOf(document.documentElement.className || '');
    if (currentIdx === -1) currentIdx = 0;
    toggleBtn.textContent = fontLabels[currentIdx];

    toggleBtn.addEventListener('click', function () {
      currentIdx = (currentIdx + 1) % fontSizes.length;
      document.documentElement.className = fontSizes[currentIdx];
      toggleBtn.textContent = fontLabels[currentIdx];
      try {
        localStorage.setItem(FONT_KEY, fontSizes[currentIdx]);
      } catch (e) {}
    });
  }
})();
