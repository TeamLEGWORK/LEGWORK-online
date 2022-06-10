import {animateCSS} from "./base.js"

window.addEventListener("load", function() {
    animateCSS("#biglogo", "rubberBand");
    this.document.getElementById("biglogo").addEventListener("click", function() {
        const choices = ["rubberBand", "tada", "shakeX", "shakeY", "wobble", "jello"];
        animateCSS("#biglogo", choices[Math.floor(Math.random()*choices.length)]);
    });

    this.document.getElementById("goto-tool").addEventListener("click", function() {
        window.location.href = "/tool";
    });

    this.document.getElementById("goto-about").addEventListener("click", function() {
        window.location.href = "/about";
    });
});