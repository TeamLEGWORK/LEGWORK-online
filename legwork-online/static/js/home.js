import {animateCSS} from "./base.js";

window.addEventListener("load", function () {
    animateCSS("#biglogo", "rubberBand");
    document.getElementById("biglogo").addEventListener("click", function () {
        const choices = ["rubberBand", "tada", "shakeX", "shakeY", "wobble", "jello"];
        animateCSS("#biglogo", choices[Math.floor(Math.random() * choices.length)]);
    });

    document.getElementById("goto-tool").addEventListener("click", function () {
        window.location.href = "/tool";
    });

    document.getElementById("goto-about").addEventListener("click", function () {
        window.location.href = "/about";
    });
});
