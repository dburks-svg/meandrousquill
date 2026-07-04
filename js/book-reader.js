(function () {
    'use strict';

    var STORAGE_MODE_KEY = 'mq-reading-mode';
    var STORAGE_KEY = 'mq-progress';
    var MOBILE_BREAKPOINT = 768;
    var TABLET_BREAKPOINT = 1024;
    var RESIZE_DEBOUNCE = 400;

    var chapterText = document.getElementById('chapter-text');
    var bookPage = document.querySelector('.book-page');
    var chapterContent = document.querySelector('.chapter-content');
    if (!chapterText || !bookPage) return;

    var chapterNum = chapterContent ? parseInt(chapterContent.getAttribute('data-chapter'), 10) : 0;
    var pageFlipInstance = null;
    var flipContainer = null;
    var originalHTML = chapterText.innerHTML;
    var resizeTimer = null;
    var announcer = null;
    var currentMode = null;

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

    function isScrollMode() {
        return document.body.classList.contains('scroll-mode');
    }

    function getViewportMode() {
        var w = window.innerWidth;
        if (w < MOBILE_BREAKPOINT) return 'mobile';
        if (w < TABLET_BREAKPOINT) return 'tablet';
        return 'desktop';
    }

    // ---- Measurement ----

    function getTextStyles() {
        var cs = window.getComputedStyle(chapterText);
        return {
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            textIndent: cs.textIndent
        };
    }

    function measurePages(pageW, pageH) {
        var ts = getTextStyles();
        var measure = document.createElement('div');
        measure.style.cssText =
            'position:absolute;left:-99999px;top:0;' +
            'width:' + pageW + 'px;' +
            'height:' + pageH + 'px;' +
            'column-width:' + pageW + 'px;column-fill:auto;' +
            'column-gap:60px;overflow:visible;' +
            'font-family:' + ts.fontFamily + ';' +
            'font-size:' + ts.fontSize + ';' +
            'line-height:' + ts.lineHeight + ';';
        measure.className = chapterText.className;
        measure.innerHTML = originalHTML;

        var extraStyles = document.createElement('style');
        extraStyles.textContent = 'p{break-inside:avoid-column;text-indent:1.5em;margin-bottom:1em}p:first-child{text-indent:0}.scene-break{break-before:column;break-inside:avoid;margin:2.5rem auto;height:24px}';
        measure.appendChild(extraStyles);

        document.body.appendChild(measure);
        void measure.offsetHeight;

        var colW = pageW + 60;
        var scrollW = measure.scrollWidth;
        var total = Math.max(1, Math.round(scrollW / colW));

        document.body.removeChild(measure);
        return total;
    }

    // ---- Page element creation ----

    var PAGE_PAD_X = 40;
    var PAGE_PAD_TOP = 30;
    var PAGE_PAD_BOTTOM = 44;

    function getTextArea(pageW, pageH) {
        return {
            w: pageW - (PAGE_PAD_X * 2),
            h: pageH - PAGE_PAD_TOP - PAGE_PAD_BOTTOM
        };
    }

    function createPageElements(totalPages, pageW, pageH) {
        var pages = [];
        var text = getTextArea(pageW, pageH);
        var colStride = text.w + 60;
        var ts = getTextStyles();

        for (var i = 0; i < totalPages; i++) {
            var page = document.createElement('div');
            page.className = 'flip-page';
            page.setAttribute('data-page', i);

            var inner = document.createElement('div');
            inner.className = 'flip-page-content';
            inner.style.cssText =
                'width:' + text.w + 'px;height:' + text.h + 'px;' +
                'column-width:' + text.w + 'px;column-fill:auto;' +
                'column-gap:60px;position:absolute;' +
                'left:' + PAGE_PAD_X + 'px;top:' + PAGE_PAD_TOP + 'px;' +
                'overflow:hidden;' +
                'font-family:' + ts.fontFamily + ';' +
                'font-size:' + ts.fontSize + ';' +
                'line-height:' + ts.lineHeight + ';';

            var contentWrap = document.createElement('div');
            contentWrap.style.cssText =
                'width:99999px;height:' + text.h + 'px;' +
                'column-width:' + text.w + 'px;column-fill:auto;' +
                'column-gap:60px;' +
                'transform:translateX(' + (-(i * colStride)) + 'px);';
            contentWrap.innerHTML = originalHTML;

            inner.appendChild(contentWrap);

            var pageNum = document.createElement('div');
            pageNum.className = 'flip-page-number';
            pageNum.textContent = (i + 1);

            page.appendChild(inner);
            page.appendChild(pageNum);
            pages.push(page);
        }
        return pages;
    }

    // ---- Nav pages (chapter transitions) ----

    function createNavPage(type) {
        var page = document.createElement('div');
        page.className = 'flip-page flip-page-nav';
        page.setAttribute('data-nav', type);

        var inner = document.createElement('div');
        inner.className = 'flip-page-nav-content';
        inner.style.cssText =
            'position:absolute;left:0;top:0;width:100%;height:100%;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'padding:' + PAGE_PAD_TOP + 'px ' + PAGE_PAD_X + 'px ' + PAGE_PAD_BOTTOM + 'px;' +
            'box-sizing:border-box;text-align:center;';

        var heading = chapterContent.querySelector('.chapter-heading');
        var chapterTitle = heading ? heading.textContent.trim() : 'Chapter ' + chapterNum;

        if (type === 'next') {
            var nextLink = document.querySelector('.chapter-nav .nav-next');
            var nextNum = chapterNum < 48 ? chapterNum + 1 : null;
            if (nextLink && nextNum) {
                inner.innerHTML =
                    '<div style="color:var(--text-secondary,#8a7a5a);font-size:0.85rem;margin-bottom:1.5rem;">End of</div>' +
                    '<div style="font-family:Cinzel,serif;color:var(--accent-gold,#c9a84c);font-size:1.3rem;letter-spacing:0.08em;margin-bottom:2.5rem;">' + chapterTitle + '</div>' +
                    '<div style="width:60px;height:1px;background:var(--accent-gold,#c9a84c);opacity:0.4;margin:0 auto 2.5rem;"></div>' +
                    '<a href="' + nextLink.href + '" class="flip-nav-link" style="font-family:Cinzel,serif;color:var(--accent-gold,#c9a84c);font-size:1.1rem;text-decoration:none;letter-spacing:0.06em;padding:0.8rem 2rem;border:1px solid rgba(201,168,76,0.3);border-radius:4px;transition:all 0.3s;"' +
                    ' onmouseenter="this.style.borderColor=\'rgba(201,168,76,0.6)\';this.style.background=\'rgba(201,168,76,0.08)\'"' +
                    ' onmouseleave="this.style.borderColor=\'rgba(201,168,76,0.3)\';this.style.background=\'none\'">' +
                    'Continue to Chapter ' + nextNum + ' →</a>';
            } else {
                inner.innerHTML =
                    '<div style="font-family:Cinzel,serif;color:var(--accent-gold,#c9a84c);font-size:1.3rem;letter-spacing:0.08em;margin-bottom:2rem;">The End</div>' +
                    '<div style="width:60px;height:1px;background:var(--accent-gold,#c9a84c);opacity:0.4;margin:0 auto 2rem;"></div>' +
                    '<div style="color:var(--text-secondary,#8a7a5a);font-size:0.9rem;line-height:1.8;max-width:280px;">' +
                    'Thank you for reading<br>Dragon\'s Eggs and Spirit Stones<br>by Deborah Burks</div>';
            }
        } else if (type === 'prev') {
            var prevLink = document.querySelector('.chapter-nav .nav-prev');
            if (prevLink && prevLink.href && chapterNum > 1) {
                inner.innerHTML =
                    '<a href="' + prevLink.href + '" class="flip-nav-link" style="font-family:Cinzel,serif;color:var(--accent-gold,#c9a84c);font-size:1rem;text-decoration:none;letter-spacing:0.06em;padding:0.8rem 2rem;border:1px solid rgba(201,168,76,0.3);border-radius:4px;transition:all 0.3s;"' +
                    ' onmouseenter="this.style.borderColor=\'rgba(201,168,76,0.6)\';this.style.background=\'rgba(201,168,76,0.08)\'"' +
                    ' onmouseleave="this.style.borderColor=\'rgba(201,168,76,0.3)\';this.style.background=\'none\'">' +
                    '← Chapter ' + (chapterNum - 1) + '</a>' +
                    '<div style="width:60px;height:1px;background:var(--accent-gold,#c9a84c);opacity:0.4;margin:2.5rem auto;"></div>' +
                    '<div style="font-family:Cinzel,serif;color:var(--accent-gold,#c9a84c);font-size:1.3rem;letter-spacing:0.08em;">' + chapterTitle + '</div>';
            }
        }

        page.appendChild(inner);
        return page;
    }

    // ---- StPageFlip initialization ----

    function initFlipbook() {
        if (pageFlipInstance) destroyFlipbook();

        document.body.classList.remove('scroll-mode');
        currentMode = 'flipbook';

        chapterText.style.display = 'none';

        var heading = chapterContent.querySelector('.chapter-heading');
        if (heading) heading.style.display = 'none';

        var contentStyle = window.getComputedStyle(chapterContent);
        var padLeft = parseFloat(contentStyle.paddingLeft) || 40;
        var padRight = parseFloat(contentStyle.paddingRight) || 40;
        var padTop = parseFloat(contentStyle.paddingTop) || 48;
        var padBottom = parseFloat(contentStyle.paddingBottom) || 32;

        var containerW = bookPage.clientWidth;
        var containerH = bookPage.clientHeight;

        var pageW = Math.floor((containerW - padLeft - padRight) / 2) - 40;
        var pageH = containerH - padTop - padBottom - 60;

        var viewMode = getViewportMode();
        if (viewMode === 'tablet') {
            pageW = Math.floor(containerW - padLeft - padRight) - 40;
        }

        if (pageW < 200) pageW = 280;
        if (pageH < 200) pageH = 400;

        var text = getTextArea(pageW, pageH);
        var totalPages = measurePages(text.w, text.h);
        var pages = createPageElements(totalPages, pageW, pageH);

        // Add nav pages for chapter flow
        var prevLink = document.querySelector('.chapter-nav .nav-prev');
        if (prevLink && prevLink.href && chapterNum > 1) {
            pages.unshift(createNavPage('prev'));
        }
        pages.push(createNavPage('next'));
        // Pad to even count for two-page spreads
        if (pages.length % 2 !== 0) {
            var blank = document.createElement('div');
            blank.className = 'flip-page flip-page-blank';
            pages.push(blank);
        }

        var contentPageCount = totalPages;

        flipContainer = document.createElement('div');
        flipContainer.id = 'flipbook-container';
        chapterContent.appendChild(flipContainer);

        pages.forEach(function (p) {
            flipContainer.appendChild(p);
        });

        var usePortrait = viewMode === 'tablet';

        pageFlipInstance = new St.PageFlip(flipContainer, {
            width: pageW,
            height: pageH,
            size: 'stretch',
            minWidth: 200,
            maxWidth: pageW + 40,
            minHeight: 300,
            maxHeight: pageH + 40,
            drawShadow: true,
            maxShadowOpacity: 0.4,
            flippingTime: prefersReducedMotion ? 0 : 700,
            usePortrait: usePortrait,
            startPage: 0,
            showCover: false,
            mobileScrollSupport: false,
            clickEventForward: true,
            disableFlipByClick: false,
            useMouseEvents: true,
            autoSize: true,
        });

        pageFlipInstance.loadFromHTML(document.querySelectorAll('#flipbook-container .flip-page'));

        var savedPage = getSavedPage();
        if (savedPage > 0 && savedPage < contentPageCount) {
            pageFlipInstance.turnToPage(savedPage);
        }

        pageFlipInstance.on('flip', function (e) {
            var page = e.data;
            updateProgressBar(page, contentPageCount);
            savePagePosition(page, contentPageCount);
            announce(page, contentPageCount);
        });

        updateProgressBar(pageFlipInstance.getCurrentPageIndex(), contentPageCount);
        createModeToggle();
    }

    function destroyFlipbook() {
        if (pageFlipInstance) {
            pageFlipInstance.destroy();
            pageFlipInstance = null;
        }
        if (flipContainer) {
            flipContainer.remove();
            flipContainer = null;
        }
        chapterText.style.display = '';
        var heading = chapterContent.querySelector('.chapter-heading');
        if (heading) heading.style.display = '';
    }

    // ---- Scroll mode ----

    function initScrollMode() {
        if (pageFlipInstance) destroyFlipbook();

        document.body.classList.add('scroll-mode');
        currentMode = 'scroll';
        chapterText.style.display = '';

        var heading = chapterContent.querySelector('.chapter-heading');
        if (heading) heading.style.display = '';

        createModeToggle();
    }

    // ---- Progress ----

    function getSavedPage() {
        var progress = getProgress();
        if (progress.pagePositions && progress.pagePositions[chapterNum] !== undefined) {
            return progress.pagePositions[chapterNum];
        }
        if (progress.scrollPositions && progress.scrollPositions[chapterNum]) {
            return 0;
        }
        return 0;
    }

    function savePagePosition(page, total) {
        var progress = getProgress();
        if (!progress.pagePositions) progress.pagePositions = {};
        progress.pagePositions[chapterNum] = page;
        progress.currentChapter = chapterNum;
        if (total > 1) {
            if (!progress.scrollPositions) progress.scrollPositions = {};
            progress.scrollPositions[chapterNum] = ((page + 1) / total).toFixed(4);
        }
        saveProgress(progress);
    }

    function updateProgressBar(page, total) {
        var bar = document.getElementById('reading-progress-bar');
        if (!bar) return;
        var pct = total > 1 ? ((page + 1) / total) * 100 : 100;
        bar.style.width = pct + '%';
    }

    function announce(page, total) {
        if (!announcer) return;
        announcer.textContent = 'Page ' + (page + 1) + ' of ' + total;
    }

    // ---- Keyboard ----

    function onKeyDown(e) {
        if (isScrollMode() || !pageFlipInstance) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            pageFlipInstance.flipNext();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            pageFlipInstance.flipPrev();
        } else if (e.key === 'Home') {
            e.preventDefault();
            pageFlipInstance.turnToPage(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            pageFlipInstance.turnToPage(pageFlipInstance.getPageCount() - 1);
        }
    }

    // ---- Mode toggle ----

    function createModeToggle() {
        var existing = document.getElementById('mode-toggle');
        if (existing) existing.remove();

        var nav = document.querySelector('.header-nav');
        if (!nav) return;

        var btn = document.createElement('button');
        btn.id = 'mode-toggle';
        btn.setAttribute('aria-label', 'Switch reading mode');
        updateToggleIcon(btn);
        btn.addEventListener('click', toggleMode);

        var fontBtn = document.getElementById('font-size-toggle');
        if (fontBtn) {
            nav.insertBefore(btn, fontBtn);
        } else {
            nav.appendChild(btn);
        }
    }

    function updateToggleIcon(btn) {
        if (!btn) btn = document.getElementById('mode-toggle');
        if (!btn) return;
        if (!isScrollMode()) {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
            btn.title = 'Switch to scroll mode';
        } else {
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
            btn.title = 'Switch to book mode';
        }
    }

    function toggleMode() {
        if (isScrollMode()) {
            setMode('book');
            var viewMode = getViewportMode();
            if (viewMode === 'mobile') {
                setMode('book');
                document.body.classList.remove('scroll-mode');
                initFlipbook();
            } else {
                initFlipbook();
            }
        } else {
            setMode('scroll');
            initScrollMode();
        }
        updateToggleIcon();
    }

    // ---- Font size change ----

    function watchFontSize() {
        var fontBtn = document.getElementById('font-size-toggle');
        if (!fontBtn) return;
        fontBtn.addEventListener('click', function () {
            if (isScrollMode() || !pageFlipInstance) return;
            var savedPage = pageFlipInstance.getCurrentPageIndex();
            setTimeout(function () {
                initFlipbook();
                if (pageFlipInstance && savedPage > 0) {
                    pageFlipInstance.turnToPage(Math.min(savedPage, pageFlipInstance.getPageCount() - 1));
                }
            }, 100);
        });
    }

    // ---- Resize ----

    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var viewMode = getViewportMode();

            if (viewMode === 'mobile' && currentMode === 'flipbook') {
                initScrollMode();
            } else if (viewMode !== 'mobile' && currentMode === 'scroll' && getMode() !== 'scroll') {
                initFlipbook();
            } else if (currentMode === 'flipbook' && pageFlipInstance) {
                var savedPage = pageFlipInstance.getCurrentPageIndex();
                initFlipbook();
                if (pageFlipInstance && savedPage > 0) {
                    pageFlipInstance.turnToPage(Math.min(savedPage, pageFlipInstance.getPageCount() - 1));
                }
            }
        }, RESIZE_DEBOUNCE);
    }

    // ---- Accessibility ----

    function createAnnouncer() {
        announcer = document.createElement('div');
        announcer.className = 'page-announce';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('role', 'status');
        document.body.appendChild(announcer);
    }

    // ---- Init ----

    function init() {
        createAnnouncer();
        watchFontSize();

        var savedMode = getMode();
        var viewMode = getViewportMode();

        if (viewMode === 'mobile' || savedMode === 'scroll') {
            initScrollMode();
        } else {
            initFlipbook();
        }

        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onResize);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
