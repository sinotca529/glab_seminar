(function registerEventListeners() {
    document
        .getElementById('expand-button')
        .addEventListener('click', function () {
            changeContentMaxWidth();
            changeFontSize();
        });
})();

// --content-max-wdith を変更する (750px と 1300px を交互に行き来)
function changeContentMaxWidth() {
    const style = document.documentElement.style;
    // note : 初回は currentWidth が取得できない。
    const currentWidth = style.getPropertyValue('--content-max-width');
    const defaultWidth = '750px';
    const wideWidth = '1300px';
    var newWidth = (currentWidth == wideWidth) ? defaultWidth : wideWidth;
    document.documentElement.style.setProperty('--content-max-width', newWidth);
}

// --font-size を変更する (62.5% と 100% を交互に行き来)
function changeFontSize() {
    const style = document.documentElement.style;
    // note : 初回は currentSize が取得できない。
    const currentSize = style.getPropertyValue('font-size');
    const defaultSize = '62.5%';
    const largeSize = '100%'
    var newSize = (currentSize == largeSize) ? defaultSize : largeSize;
    document.documentElement.style.setProperty('font-size', newSize);
}
