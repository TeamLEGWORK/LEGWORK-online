window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']]
    },
    inTabOrder: false,
    startup: {
        pageReady: function() {
            return MathJax.startup.defaultPageReady().then(function () {
                document.querySelectorAll(".input-group-text .MathJax").forEach(function(el) {
                    el.setAttribute("tabindex", "-1")
                })
            })
        }
    }
};
