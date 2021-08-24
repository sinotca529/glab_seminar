(function registerEventListeners() {
    loadAndSetContentMaxWidth();
    loadAndSetFontSize();
    document
        .getElementById('expand-button')
        .addEventListener('click', function () {
            changeContentMaxWidth();
            changeFontSize();
        });
})();

function loadAndSetContentMaxWidth() {
    var width;
    try { width = localStorage.getItem('mdbook-content-max-width'); } catch (e) { }
    if (!(width === null || width === undefined)) {
        document.documentElement.style.setProperty('--content-max-width', width);
    }
}

function loadAndSetFontSize() {
    var size;
    try { size = localStorage.getItem('mdbook-font-size'); } catch (e) { }
    if (!(size === null || size === undefined)) {
        document.documentElement.style.setProperty('font-size', size);
    }
}

// --content-max-width を変更する (750px と 1300px を交互に行き来)
function changeContentMaxWidth() {
    const style = document.documentElement.style;
    // note : 初回は currentWidth が取得できない。
    const currentWidth = style.getPropertyValue('--content-max-width');
    const defaultWidth = '750px';
    const wideWidth = '1300px';
    var newWidth = (currentWidth == wideWidth) ? defaultWidth : wideWidth;
    document.documentElement.style.setProperty('--content-max-width', newWidth);
    try { localStorage.setItem('mdbook-content-max-width', newWidth); } catch (e) { }
}

// font-size を変更する (62.5% と 100% を交互に行き来)
function changeFontSize() {
    const style = document.documentElement.style;
    // note : 初回は currentSize が取得できない。
    const currentSize = style.getPropertyValue('font-size');
    const defaultSize = '62.5%';
    const largeSize = '100%'
    var newSize = (currentSize == largeSize) ? defaultSize : largeSize;
    document.documentElement.style.setProperty('font-size', newSize);
    try { localStorage.setItem('mdbook-font-size', newSize); } catch (e) { }
}
