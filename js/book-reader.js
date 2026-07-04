(function () {
    'use strict';

    var STORAGE_MODE_KEY = 'mq-reading-mode';
    var STORAGE_KEY = 'mq-progress';
    var MIN_SWIPE = 50;
    var RESIZE_DEBOUNCE = 250;

    var chapterText = document.getElementById('chapter-text');
    var bookPage = document.querySelector('.book-page');
    var chapterContent = document.querySelector('.chapter-content');
    if (!chapterText || !bookPage) return;

    var paginationViewport = document.createElement('div');
    paginationViewport.className = 'pagination-viewport';
    chapterText.parentNode.insertBefore(paginationViewport, chapterText);
    paginationViewport.appendChild(chapterText);

    var chapterNum = chapterContent ? parseInt(chapterContent.getAttribute('data-chapter'), 10) : 0;
    var totalPages = 1;
    var currentPage = 0;
    var isAnimating = false;
    var pageIndicator = null;
    var announcer = null;
    var resizeTimer = null;
    var pointerStartX = 0;
    var pointerStartY = 0;
    var pointerTracking = false;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function getProgress() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function saveProgress(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function getMode() {
        return localStorage.getItem(STORAGE_MODE_KEY) || 'book';
    }

    function setMode(mode) {
        localStorage.setItem(STORAGE_MODE_KEY, mode);
    }

    function isBookMode() {
        return !document.body.classList.contains('scroll-mode');
    }

    // ---- Pagination ----

    function paginate() {
        if (!isBookMode()) return;

        var heading = chapterContent.querySelector('.chapter-heading');
        var headingHeight = heading ? heading.offsetHeight + 40 : 80;
        var contentPadding = 100;

        var availableHeight = bookPage.clientHeight - headingHeight - contentPadding;
        var contentStyle = window.getComputedStyle(chapterContent);
        var padLeft = parseFloat(contentStyle.paddingLeft) || 40;
        var padRight = parseFloat(contentStyle.paddingRight) || 40;
        var availableWidth = chapterContent.clientWidth - padLeft - padRight - 30;

        if (availableHeight < 200) availableHeight = 400;
        if (availableWidth < 200) availableWidth = 280;

        paginationViewport.style.height = availableHeight + 'px';
        paginationViewport.style.overflow = 'hidden';
        paginationViewport.style.position = 'relative';

        paginationViewport.style.width = availableWidth + 'px';

        chapterText.classList.add('paginated');
        chapterText.style.height = availableHeight + 'px';
        chapterText.style.columnWidth = availableWidth + 'px';

        void chapterText.offsetHeight;

        var colW = getColumnWidth();
        var scrollW = chapterText.scrollWidth;
        totalPages = Math.max(1, Math.ceil(scrollW / colW));

        if (currentPage >= totalPages) {
            currentPage = totalPages - 1;
        }

        showPage(currentPage, false);
        updateIndicator();
        updateProgressBar();
    }

    function getColumnWidth() {
        var style = window.getComputedStyle(chapterText);
        var colWidth = parseFloat(style.columnWidth) || chapterText.clientWidth;
        var gap = parseFloat(style.columnGap) || 60;
        return colWidth + gap;
    }

    function showPage(page, animate) {
        if (page < 0 || page >= totalPages) return;

        var oldPage = currentPage;
        currentPage = page;

        var colW = getColumnWidth();
        var offset = -(currentPage * colW);

        if (animate && !prefersReducedMotion && Math.abs(oldPage - currentPage) === 1) {
            runFlipAnimation(oldPage < currentPage ? 'forward' : 'backward', function () {
                chapterText.style.transform = 'translateX(' + offset + 'px)';
            });
        } else {
            chapterText.style.transform = 'translateX(' + offset + 'px)';
        }

        updateIndicator();
        updateProgressBar();
        savePagePosition();
        announce();
    }

    function updateIndicator() {
        if (!pageIndicator) return;
        pageIndicator.textContent = (currentPage + 1) + ' / ' + totalPages;
    }

    function updateProgressBar() {
        var bar = document.getElementById('reading-progress-bar');
        if (!bar || !isBookMode()) return;
        var pct = totalPages > 1 ? ((currentPage + 1) / totalPages) * 100 : 100;
        bar.style.width = pct + '%';
    }

    function savePagePosition() {
        var progress = getProgress();
        if (!progress.pagePositions) progress.pagePositions = {};
        progress.pagePositions[chapterNum] = currentPage;
        progress.currentChapter = chapterNum;
        if (totalPages > 1) {
            if (!progress.scrollPositions) progress.scrollPositions = {};
            progress.scrollPositions[chapterNum] = ((currentPage + 1) / totalPages).toFixed(4);
        }
        saveProgress(progress);
    }

    function restorePagePosition() {
        var progress = getProgress();
        if (progress.pagePositions && progress.pagePositions[chapterNum] !== undefined) {
            currentPage = Math.min(progress.pagePositions[chapterNum], totalPages - 1);
        } else if (progress.scrollPositions && progress.scrollPositions[chapterNum]) {
            var pct = parseFloat(progress.scrollPositions[chapterNum]);
            currentPage = Math.min(Math.floor(pct * totalPages), totalPages - 1);
        }
        if (currentPage < 0) currentPage = 0;
    }

    function announce() {
        if (!announcer) return;
        announcer.textContent = 'Page ' + (currentPage + 1) + ' of ' + totalPages;
    }

    // ---- Page flip animation ----

    function runFlipAnimation(direction, onMidpoint) {
        if (isAnimating) return;
        isAnimating = true;

        var overlay = document.createElement('div');
        overlay.className = 'flip-overlay';
        overlay.innerHTML = '<div class="flip-front"></div><div class="flip-back"></div>';

        bookPage.style.perspective = '1200px';
        bookPage.appendChild(overlay);

        void overlay.offsetHeight;
        overlay.classList.add(direction === 'forward' ? 'flipping-forward' : 'flipping-backward');

        if (onMidpoint) {
            setTimeout(onMidpoint, 250);
        }

        overlay.addEventListener('animationend', function () {
            overlay.remove();
            bookPage.style.perspective = '';
            isAnimating = false;
        });

        setTimeout(function () {
            if (isAnimating) {
                overlay.remove();
                bookPage.style.perspective = '';
                isAnimating = false;
            }
        }, 700);
    }

    // ---- Navigation ----

    function nextPage() {
        if (isAnimating) return;
        if (currentPage < totalPages - 1) {
            showPage(currentPage + 1, true);
        } else {
            goToNextChapter();
        }
    }

    function prevPage() {
        if (isAnimating) return;
        if (currentPage > 0) {
            showPage(currentPage - 1, true);
        } else {
            goToPrevChapter();
        }
    }

    function goToNextChapter() {
        var nextLink = document.querySelector('.nav-next');
        if (nextLink && nextLink.href) {
            window.location.href = nextLink.href;
        }
    }

    function goToPrevChapter() {
        var prevLink = document.querySelector('.nav-prev');
        if (prevLink && prevLink.href) {
            window.location.href = prevLink.href;
        }
    }

    // ---- Keyboard handling ----

    function onKeyDown(e) {
        if (!isBookMode()) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            nextPage();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            prevPage();
        } else if (e.key === 'Home') {
            e.preventDefault();
            showPage(0, false);
        } else if (e.key === 'End') {
            e.preventDefault();
            showPage(totalPages - 1, false);
        }
    }

    // ---- Touch / pointer handling ----

    function onPointerDown(e) {
        if (!isBookMode()) return;
        if (e.target.closest('a, button')) return;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pointerTracking = true;
    }

    function onPointerUp(e) {
        if (!pointerTracking) return;
        pointerTracking = false;

        var dx = e.clientX - pointerStartX;
        var dy = e.clientY - pointerStartY;

        if (Math.abs(dx) > MIN_SWIPE && Math.abs(dy) < Math.abs(dx)) {
            if (dx < 0) {
                nextPage();
            } else {
                prevPage();
            }
        }
    }

    // ---- Tap zones ----

    function createNavZones() {
        var prevZone = document.createElement('div');
        prevZone.className = 'page-nav-zone nav-prev';
        prevZone.setAttribute('aria-hidden', 'true');
        prevZone.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>';
        prevZone.addEventListener('click', function (e) {
            e.stopPropagation();
            prevPage();
        });

        var nextZone = document.createElement('div');
        nextZone.className = 'page-nav-zone nav-next';
        nextZone.setAttribute('aria-hidden', 'true');
        nextZone.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
        nextZone.addEventListener('click', function (e) {
            e.stopPropagation();
            nextPage();
        });

        bookPage.appendChild(prevZone);
        bookPage.appendChild(nextZone);
    }

    // ---- Mode toggle ----

    function createModeToggle() {
        var nav = document.querySelector('.header-nav');
        if (!nav) return;

        var btn = document.createElement('button');
        btn.id = 'mode-toggle';
        btn.setAttribute('aria-label', 'Switch reading mode');
        updateToggleLabel(btn);
        btn.addEventListener('click', toggleMode);

        var fontBtn = document.getElementById('font-size-toggle');
        if (fontBtn) {
            nav.insertBefore(btn, fontBtn);
        } else {
            nav.appendChild(btn);
        }
    }

    function updateToggleLabel(btn) {
        if (!btn) btn = document.getElementById('mode-toggle');
        if (!btn) return;
        if (isBookMode()) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
            btn.title = 'Switch to scroll mode';
        } else {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
            btn.title = 'Switch to book mode';
        }
    }

    function toggleMode() {
        if (isBookMode()) {
            document.body.classList.add('scroll-mode');
            chapterText.classList.remove('paginated');
            chapterText.style.height = '';
            chapterText.style.columnWidth = '';
            chapterText.style.transform = '';
            setMode('scroll');
        } else {
            document.body.classList.remove('scroll-mode');
            setMode('book');
            currentPage = 0;
            restorePagePosition();
            paginate();
        }
        updateToggleLabel();
    }

    // ---- Font size change detection ----

    function watchFontSize() {
        var fontBtn = document.getElementById('font-size-toggle');
        if (!fontBtn) return;
        fontBtn.addEventListener('click', function () {
            if (!isBookMode()) return;
            var anchorPara = findAnchorParagraph();
            setTimeout(function () {
                paginate();
                if (anchorPara) {
                    jumpToAnchor(anchorPara);
                }
            }, 50);
        });
    }

    function findAnchorParagraph() {
        var paras = chapterText.querySelectorAll('p');
        var contentRect = chapterText.getBoundingClientRect();
        for (var i = 0; i < paras.length; i++) {
            var r = paras[i].getBoundingClientRect();
            if (r.left >= contentRect.left && r.left < contentRect.left + chapterText.clientWidth) {
                return i;
            }
        }
        return 0;
    }

    function jumpToAnchor(paraIndex) {
        var paras = chapterText.querySelectorAll('p');
        if (paraIndex >= paras.length) return;
        var para = paras[paraIndex];
        var paraLeft = para.offsetLeft;
        var colW = chapterText.clientWidth + 60;
        var targetPage = Math.floor(paraLeft / colW);
        currentPage = Math.min(targetPage, totalPages - 1);
        showPage(currentPage, false);
    }

    // ---- Resize handling ----

    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (!isBookMode()) return;
            var anchorPara = findAnchorParagraph();
            paginate();
            if (anchorPara) {
                jumpToAnchor(anchorPara);
            }
        }, RESIZE_DEBOUNCE);
    }

    // ---- Page indicator ----

    function createPageIndicator() {
        pageIndicator = document.createElement('div');
        pageIndicator.className = 'page-indicator';
        pageIndicator.setAttribute('aria-hidden', 'true');
        bookPage.appendChild(pageIndicator);

        announcer = document.createElement('div');
        announcer.className = 'page-announce';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('role', 'status');
        document.body.appendChild(announcer);
    }

    // ---- Initialize ----

    function init() {
        var mode = getMode();
        if (mode === 'scroll') {
            document.body.classList.add('scroll-mode');
        }

        createModeToggle();
        createPageIndicator();
        createNavZones();
        watchFontSize();

        if (isBookMode()) {
            restorePagePosition();
            paginate();
        }

        document.addEventListener('keydown', onKeyDown);
        bookPage.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('pointerup', onPointerUp);
        window.addEventListener('resize', onResize);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
