window.MathJax = {
    tex: {
        inlineMath: [
            ['$', '$'],
            ['\\(', '\\)']
        ]
    },
    inTabOrder: false,
    startup: {
        pageReady: function () {
            return MathJax.startup.defaultPageReady().then(function () {
                document.querySelectorAll(".input-group-text .MathJax").forEach(function (el) {
                    el.setAttribute("tabindex", "-1")
                })
            })
        }
    }
};


$('body').on('scroll', function () {
    // will give position of scrollbar
    var height = $(this).scrollHeight();
    if (height > 100) {
        // this will update the font size
        $('.navbar-brand').addClass('scrollFontSize')
    } else if (height === 0) {
        // removing specific font size on scrolling back to top
        $('.navbar-brand').removeClass('scrollFontSize')
    }
})