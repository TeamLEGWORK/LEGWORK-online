import {animateCSS} from "./base.js"

window.addEventListener("load", function() {
    this.document.getElementById("me-headshot-col").classList.remove("hide");
    animateCSS("#me-headshot-col", "bounceInLeft");
    this.document.getElementById("katie-headshot-col").classList.remove("hide");
    animateCSS("#katie-headshot-col", "bounceInRight");
});