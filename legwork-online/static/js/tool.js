import {animateCSS} from "./base.js";

// for converting csv headings to nice html things
const header_to_longname = {
    m_1: "Primary Mass [M<sub>⊙</sub>]",
    m_2: "Secondary Mass [M<sub>⊙</sub>]",
    f_orb: "Orbital Frequency [Hz]",
    ecc: "Eccentricity",
    dist: "Distance [kpc]",
    snr: "Signal-to-Noise Ratio",
    t_merge: "Time until merger [Myr]",
    total_strain: "Total strain",
    total_char_strain: "Total characteristic strain",
    merged: "Source has merged?",
};

// stores current input data
let data = {
    sources: {
        m_1: null,
        m_2: null,
        f_orb: null,
        ecc: null,
        dist: null,
        t_merge: null,
        snr: null,
        total_strain: null,
        total_char_strain: null,
        merged: null,
    },
    detector: {
        instrument: "LISA",
        duration: 4,
        approximate_response_function: false,
        confusion_noise_model: "robson19",
    },
    settings: {
        gw_lum_tol: 0.05,
        stat_tol: 0.1,
        interpolate_g: false,
        interpolate_sc: true,
    },
};

window.addEventListener("load", function () {
    // grab the template for later use
    const template = document.getElementById("helper-template");

    // loop over each helper
    document.querySelectorAll(".helper").forEach(function (el) {
        // clone the template and reveal it
        let helper = template.cloneNode(true);
        helper.id = "";

        // cut and paste the title
        helper.setAttribute("title", el.getAttribute("title"));
        el.setAttribute("title", "");

        // attach it to the DOM
        el.appendChild(helper);
    });

    // activate all of the tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    ["dragover", "dragenter"].forEach(function (et) {
        document.querySelector(".file-drop-box-container").addEventListener(et, function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add("file-is-over");
            this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
                el.classList.add("hide");
            });
            this.querySelector(".file-drop-box .ready-to-drop").classList.remove("hide");
        });
    });

    ["dragend", "dragleave"].forEach(function (et) {
        document.querySelector(".file-drop-box-container").addEventListener(et, function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove("file-is-over");
            this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
                el.classList.add("hide");
            });
            this.querySelector(".file-drop-box .pre-upload").classList.remove("hide");
        });
    });

    document.querySelector(".file-drop-box-container").addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove("file-is-over");
        this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
            el.classList.add("hide");
        });
        this.querySelector(".file-drop-box .uploading").classList.remove("hide");
        animateCSS(".file-drop-box .uploading", "bounceIn");

        const dropped_file = e.dataTransfer.files[0];
        read_csv_input(dropped_file);
    });

    this.document.querySelector(".file-drop-box-container").addEventListener("click", function () {
        document.getElementById("source-csv-file").click();
    });

    // handle them choosing a file directly
    document.querySelector(".file-drop-box-choose").addEventListener("change", function (e) {
        read_csv_input(e.target.files[0]);
    });

    // input initialisation (basically just updated the global variable and add to output table)
    document.querySelector("#init").addEventListener("click", function () {
        update_inputs();

        if (document.querySelector("#input-single-source-tab").classList.contains("active")) {
            const rows = [
                ["m_1", "m_2", "f_orb", "ecc", "dist"],
                [data["sources"]["m_1"], data["sources"]["m_2"], data["sources"]["f_orb"], data["sources"]["ecc"], data["sources"]["dist"]],
            ];
            create_table(rows);
        }

        inject_toast("Inputs updated!", "", "2000");

        document.querySelector("#init").classList.add("btn-outline-primary");
        document.querySelector("#init").classList.remove("btn-primary");
        document.querySelector("#init-warning").classList.add("hide");
        this.innerText = "Reset and update inputs";
        this.blur();
    });

    // set up random sources page
    const dists = [
        {
            id: "m_1",
            name: "Primary Mass",
            min: 0,
            max: 50,
            mean: 10,
            sigma: 1,
            units: "M<sub>⊙</sub>",
            log: false,
        },
        {
            id: "q",
            name: "Mass Ratio",
            min: 0,
            max: 1,
            mean: 0.5,
            sigma: 0.1,
            units: null,
            log: false,
        },
        {
            id: "f_orb",
            name: "Orbital Frequency",
            min: 1e-5,
            max: 1e-2,
            mean: 1e-3,
            sigma: 1,
            units: "Hz",
            log: true,
        },
        {
            id: "ecc",
            name: "Eccentricity",
            min: 0,
            max: 0.1,
            mean: 0.05,
            sigma: 0.01,
            units: null,
            log: false,
        },
        {
            id: "dist",
            name: "Distance",
            min: 0,
            max: 30,
            mean: 8,
            sigma: 1,
            units: "kpc",
            log: false,
        },
    ];
    const rand_ids = ["random-var-dist", "random-var-scale", "random-var-collapse-uniform", "random-var-collapse-normal", "random-var-min", "random-var-max", "random-var-mean", "random-var-sigma"];
    for (let i = 0; i < dists.length; i++) {
        const rnd_dist = document.getElementById("random-var-template").cloneNode(true);
        rnd_dist.id = "random-" + dists[i]["id"];
        rnd_dist.classList.remove("hide");

        rnd_dist.querySelector(".dist-label").innerHTML = dists[i]["name"];

        rnd_dist.querySelector("#random-var-min").value = dists[i]["min"];
        rnd_dist.querySelector("#random-var-max").value = dists[i]["max"];
        rnd_dist.querySelector("#random-var-mean").value = dists[i]["mean"];
        rnd_dist.querySelector("#random-var-sigma").value = dists[i]["sigma"];

        if (dists[i]["units"] != null) {
            rnd_dist.querySelectorAll(".input-group.units").forEach(group => {
                const text = document.createElement("div");
                text.classList.add("input-group-text");
                text.innerHTML = dists[i]["units"];
                group.appendChild(text);
            });
        }

        if (dists[i]["log"]) {
            rnd_dist.querySelector("#random-var-scale").value = "log";
        }

        // reset ids
        rand_ids.forEach(id => {
            rnd_dist.querySelector("#" + id).id = id.replace("var", dists[i].id);
        });

        rnd_dist.querySelector("select.dist-select").addEventListener("change", function () {
            // disable the select to stop interference
            this.setAttribute("disabled", "true");
            const disttype = this.value;

            let soon_open = null;
            if (disttype == "uniform") {
                soon_open = rnd_dist.querySelector(".uni-collapse");
            } else if (disttype == "normal") {
                soon_open = rnd_dist.querySelector(".norm-collapse");
            }

            // find the currently open collapse
            const open = rnd_dist.querySelector(".collapse.show");

            if (open == soon_open) {
                return;
            }

            // add a listener for once the open once is closed
            open.addEventListener("hidden.bs.collapse", function () {
                    // prep the next collapse
                    const collapse = new bootstrap.Collapse(soon_open);

                    // once it has been shown then re-enable the select
                    soon_open.addEventListener("shown.bs.collapse", function () {
                            rnd_dist.querySelector("select.dist-select").removeAttribute("disabled");
                    }, {once: true});

                    // show the collapse
                    collapse.show();
            }, {once: true});

            // close the current one
            const open_collapse = new bootstrap.Collapse(open);
            open_collapse.hide();
        });

        document.querySelector("#input-random-sources").insertBefore(rnd_dist,
                                                                     document.querySelector("#random"));
    }
    const random_template = document.getElementById("random-var-template");
    random_template.parentElement.removeChild(random_template);

    // set up generate random sources button
    document.querySelector("#random").addEventListener("click", function () {
        let random_gen_data = {
            count: parseInt(document.querySelector("#random-how-many").value),
            dists: []
        }
        dists.forEach(dist => {
            random_gen_data["dists"].push({
                "id": dist["id"],
                "dist": document.querySelector("#random-" + dist["id"] + "-dist").value,
                "scale": document.querySelector("#random-" + dist["id"] + "-scale").value,
                "min": parseFloat(document.querySelector("#random-" + dist["id"] + "-min").value),
                "max": parseFloat(document.querySelector("#random-" + dist["id"] + "-max").value),
                "mean": parseFloat(document.querySelector("#random-" + dist["id"] + "-mean").value),
                "sigma": parseFloat(document.querySelector("#random-" + dist["id"] + "-sigma").value),
            });
        });

        const button = document.querySelector("#random");
        const original_html = button.innerHTML;
        add_loader(button, "Generating...");
        
        $.ajax({
            type: "POST",
            url: "/tool/random-sources",
            data: JSON.stringify(random_gen_data),
            contentType: "application/json; charset=utf-8",
            success: function (response) {
                console.log(response);
                response["sources"].forEach(param => {
                    data["sources"][param["id"]] = param["values"];
                });

                console.log(data);

                let rows = new Array(data["sources"]["m_1"].length);
                rows[0] = ["m_1", "m_2", "f_orb", "ecc", "dist"]

                for (let i = 0; i < data["sources"]["m_1"].length; i++) {
                    rows[i + 1] = [data["sources"]["m_1"][i], data["sources"]["m_2"][i],
                                   data["sources"]["f_orb"][i], data["sources"]["ecc"][i],
                                   data["sources"]["dist"][i]]
                }
                create_table(rows);

                inject_toast("Random sources generated! See table for results.", response["runtime"]);
                button.innerHTML = original_html;
            },
            error: function (response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, "text/html");
                alert_user("Error: generation failed", doc.querySelector(".errormsg").innerHTML, response.responseText);
                button.innerHTML = original_html;
            },
        });
    });

    // calculate the SNR using the API
    document.querySelector("#snr").addEventListener("click", function () {
        make_calculation("#snr", "snr", "Signal-to-noise ratio");
    });

    document.querySelector("#merger-time").addEventListener("click", function () {
        make_calculation("#merger-time", "t_merge", "Merger time");
    });

    document.querySelector("#total-strain").addEventListener("click", function () {
        make_calculation("#total-strain", "total_strain", "Total strain");
    });

    document.querySelector("#total-characteristic-strain").addEventListener("click", function () {
        make_calculation("#total-characteristic-strain", "total_char_strain", "Total characteristic strain");
    });

    document.querySelector("#evolve").addEventListener("click", function () {
        if (!enforce_inputs()) {
            return;
        }

        const time_string = document.querySelector("#evolve-time").value;
        let time = 0;
        if (time_string.includes(",")) {
            time = [];
            time_string.split(",").forEach((el) => time.push(parseFloat(el)));

            if (time.length != data["sources"]["m_1"].length) {
                alert_user("Number of evolution times does not match number of sources.");
                return;
            }
            for (let i = 0; i < time.length; i++) {
                if (time[i] < 0 || isNaN(time[i])) {
                    alert_user("Invalid evolution time detected: " + time[i]);
                    return;
                }
            }
        } else {
            time = parseFloat(time_string);
            if (time < 0 || isNaN(time)) {
                alert_user("Invalid evolution time detected: " + time);
                return;
            }
        }

        data["t_evol"] = time;

        const button = document.querySelector("#evolve");
        const original_html = button.innerHTML;
        add_loader(button, "Evolving...");
        $.ajax({
            type: "POST",
            url: "/tool/evolve",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            success: function (response) {
                ["f_orb", "ecc", "t_merge", "merged"].forEach((prop) => {
                    insert_or_update_column(prop, response[prop]);
                    data["sources"][prop] = response[prop];
                });

                delete_column("snr");
                delete_column("total_strain");
                delete_column("total_char_strain");

                const table_rows = document.querySelectorAll("table tbody tr");
                for (let i = 0; i < response["merged"].length; i++) {
                    if (response["merged"][i] == 1) {
                        table_rows[i].classList.add("source-merged");
                    }
                }

                inject_toast("Evolution complete! See table for results.", response["runtime"]);
                button.innerHTML = original_html;
            },
            error: function (response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, "text/html");
                alert_user("Error: evolution failed", doc.querySelector(".errormsg").innerHTML, response.responseText);
                button.innerHTML = original_html;
            },
        });
    });

    document.querySelectorAll("#inputs-card input").forEach((el) => {
        el.addEventListener("change", function () {
            document.querySelector("#init").classList.remove("btn-outline-primary");
            document.querySelector("#init").classList.add("btn-primary");
            document.querySelector("#init-warning").classList.remove("hide");
        });
    });

    document.querySelector("#toggle-plots").addEventListener("click", function () {
        let i = this.querySelector("i");
        i.classList.toggle("fa-chevron-up");
        i.classList.toggle("fa-chevron-down");
    });

    // set up the carousel and buttons to move it
    const carousel = new bootstrap.Carousel("#plot-carousel");
    document.querySelectorAll("#plot-carousel-tabs .nav-link").forEach(function (el) {
        el.addEventListener("click", function () {
            document.querySelectorAll("#plot-carousel-tabs .nav-link").forEach(function (el) {
                el.classList.remove("active");
            });
            this.classList.add("active");

            carousel.to(this.getAttribute("data-bs-slide-to"));
        });
    });

    // sneaky colour selection
    document.querySelectorAll(".colour-label input").forEach(el => {
        el.addEventListener("change", function () {
            el.parentElement.style.backgroundColor = this.value;
        });
    });

    // set up switching collapses for 1D+2D plots
    ["oned", "twod"].forEach(dimensions => {
        document.querySelector("#" + dimensions + "-plot-disttype").addEventListener("change", function () {
            // disable the select to stop interference
            this.setAttribute("disabled", "true");
            const disttype = this.value;

            // find the currently open collapse
            const open = document.querySelector("#" + dimensions + "-plot-pane .collapse.show");

            // add a listener for once the open once is closed
            open.addEventListener("hidden.bs.collapse", function () {
                    // prep the next collapse
                    const soon_open = document.querySelector("#" + dimensions + "-collapse-" + disttype);
                    const collapse = new bootstrap.Collapse(soon_open);

                    // once it has been shown then re-enable the select
                    soon_open.addEventListener("shown.bs.collapse", function () {
                            document.querySelector("#" + dimensions + "-plot-disttype").removeAttribute("disabled");
                    }, {once: true});

                    // show the collapse
                    collapse.show();
            }, {once: true});

            // close the current one
            const open_collapse = new bootstrap.Collapse(open);
            open_collapse.hide();
        });
    });

    document.querySelector("#create-plot").addEventListener("click", function () {
        const button = this;
        const original_html = this.innerHTML;

        const plotType = document.querySelector("#plot-collapse .nav-link.active").id;
        switch (plotType) {
            case "plot-sc": {
                data["plot_params"] = {
                    frequency_range: [parseFloat(document.getElementById("sc-plot-f-range-lower").value),
                                      parseFloat(document.getElementById("sc-plot-f-range-upper").value)],
                    fill: document.getElementById("sc-plot-fill").checked,
                    fill_colour: document.getElementById("sc-plot-fill-colour").value,
                    fill_opacity: parseFloat(document.getElementById("sc-plot-fill-opacity").value),
                    linewidth: parseFloat(document.getElementById("sc-plot-lw").value),
                    include_sources: document.getElementById("sc-plot-include-sources").checked,
                    sources_dist: document.getElementById("sc-plot-sources-disttype").value,
                    sources_colour: document.getElementById("sc-plot-sources-colour").value,
                    include_vbs: document.getElementById("sc-plot-include-vbs").checked,
                    legend: document.getElementById("sc-plot-legend").checked,
                };
                if (data["plot_params"]["include_sources"] && !enforce_inputs()) {
                    return;
                }
                break;
            }
            case "plot-oned": {
                if (!enforce_inputs()) {
                    return;
                }
                data["plot_params"] = {
                    xstr: document.getElementById("oned-plot-var").value,
                    linewidth: parseFloat(document.getElementById("oned-plot-lw").value),
                    exclude_merged: document.getElementById("oned-plot-exclude-merged").checked,
                    disttype: document.getElementById("oned-plot-disttype").value,
                    colour: document.getElementById("oned-plot-colour").value,
                    bins: document.getElementById("oned-plot-bins").value,
                    histtype: document.getElementById("oned-plot-histtype").value,
                    bw_adjust: parseFloat(document.getElementById("oned-plot-bw-adjust").value),
                    stat: document.getElementById("oned-plot-stat").value,
                    scale: document.getElementById("oned-plot-scale").value,
                };
                break;
            }
            case "plot-twod": {
                if (!enforce_inputs()) {
                    return;
                }
                data["plot_params"] = {
                    xstr: document.getElementById("twod-plot-xstr").value,
                    ystr: document.getElementById("twod-plot-ystr").value,
                    xscale: document.getElementById("twod-plot-xscale").value,
                    yscale: document.getElementById("twod-plot-yscale").value,
                    exclude_merged: document.getElementById("twod-plot-exclude-merged").checked,
                    disttype: document.getElementById("twod-plot-disttype").value,
                    colour: document.getElementById("twod-plot-colour").value,
                    scatter_s: parseFloat(document.getElementById("twod-plot-s").value),
                    marker: document.getElementById("twod-plot-marker").value,
                    alpha: parseFloat(document.getElementById("twod-plot-alpha").value),
                    bw_adjust: parseFloat(document.getElementById("twod-plot-bw-adjust").value),
                    fill: document.getElementById("twod-plot-fill").checked,
                };
                break;
            }
        }

        add_loader(button, "Plotting...");

        $.ajax({
            type: "POST",
            url: "/tool/" + plotType,
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            success: function (response) {
                document.querySelectorAll("#plot-carousel .carousel-item.active img").forEach(el => {
                    el.src = "data:image/png;base64," + response;
                });
                button.innerHTML = original_html;
            },
            error: function (response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, "text/html");
                alert_user("Error: Failed to create plot", doc.querySelector(".errormsg").innerHTML, response.responseText);
                button.innerHTML = original_html;
            },
        });
    });

    ["keyup", "change"].forEach(function (e) {
        document.querySelector("#data-precision").addEventListener(e, function () {
            const precision = parseInt(this.value);
            if (precision != NaN && precision >= 0) {
                document.querySelectorAll("table tbody td").forEach(function (el) {
                    el.innerText = format_number(parseFloat(el.getAttribute("data-unrounded")), precision);
                });
            }
        });
    });

    document.querySelector("#download").addEventListener("click", download_table);
});

function read_csv_input(file) {
    let success = true;

    const fileReader = new FileReader();
    fileReader.readAsText(file);

    fileReader.onload = function () {
        const dataset = fileReader.result;
        const rows = dataset.split("\n").map((data) => data.split(","));

        for (let i = 0; i < rows.length; i++) {
            if (rows[i].length !== rows[0].length) {
                rows.splice(i, 1);
            }
        }

        for (let i = 0; i < rows[0].length; i++) {
            if (rows[0][i] in header_to_longname) {
                let source_prop = [];
                for (let j = 1; j < rows.length; j++) {
                    source_prop.push(parseFloat(rows[j][i]));
                }
                data["sources"][rows[0][i]] = source_prop;
            } else {
                alert_user("Unknown header detected in csv file: " + rows[0][i].toString());
                success = false;
            }
        }

        if (success) {
            inject_toast("File upload complete, check out your data in the table below!", "", "3000");
            document.getElementById("source-csv-file-label").innerHTML = `
                Success! <strong>Upload another file?</strong></label>
            `;
            animateCSS(".file-drop-box-container", "jello");

            // delete old columns
            let delete_these = ["snr", "t_merge", "merged", "total_strain", "total_char_strain"];
            let remaining = delete_these.filter(x => !rows[0].includes(x));
            remaining.forEach(param => {
                data["sources"][param] = null;
            });

            create_table(rows);
            document.querySelector("#init").click();
        } else {
            document.getElementById("source-csv-file-label").innerHTML = `
                Uh oh, there's a problem with your file! <strong>Try again?</strong></label>
            `;
            animateCSS(".file-drop-box-container", "headShake");
        }
        document.querySelectorAll(".file-drop-box .message").forEach(function (el) {
            el.classList.add("hide");
        });
        document.querySelector(".file-drop-box .pre-upload").classList.remove("hide");
    };
}

function create_table(rows) {
    let table = document.createElement("table");
    table.classList.add("table", "table-striped");

    let thead = document.createElement("thead");
    table.appendChild(thead);

    let thead_tr = document.createElement("tr");
    thead.appendChild(thead_tr);

    let th = document.createElement("th");
    th.innerText = "Source ID";
    th.setAttribute("data-csv-header", "id");
    thead_tr.appendChild(th);

    for (let i = 0; i < rows[0].length; i++) {
        let th = document.createElement("th");

        if (rows[0][i] in header_to_longname) {
            th.innerHTML = header_to_longname[rows[0][i]];
        } else {
            th.innerHTML = rows[0][i];
        }
        th.setAttribute("data-csv-header", rows[0][i]);
        thead_tr.appendChild(th);
    }

    let tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const precision = parseInt(document.querySelector("#data-precision").value);

    for (let i = 1; i < rows.length; i++) {
        if (rows[i].length > 1) {
            let tr = document.createElement("tr");
            let th = document.createElement("th");
            th.setAttribute("scope", "row");
            th.setAttribute("data-unrounded", i - 1);
            th.innerText = i - 1;
            tr.appendChild(th);

            for (let j = 0; j < rows[i].length; j++) {
                let td = document.createElement("td");
                td.setAttribute("data-unrounded", rows[i][j]);
                td.innerText = format_number(parseFloat(rows[i][j]), precision);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }
    document.getElementById("sources-table").innerHTML = "";
    document.getElementById("sources-table").appendChild(table);
}

function insert_or_update_column(header, data) {
    const table = document.querySelector("#sources-table table");

    let translated_header = header;
    if (header in header_to_longname) {
        translated_header = header_to_longname[header];
    }

    let ths = table.querySelectorAll("th");
    let col_index = -1;
    for (let i = 1; i < ths.length; i++) {
        if (ths[i].innerHTML == translated_header) {
            col_index = i - 1;
            break;
        }
    }

    const precision = parseInt(document.querySelector("#data-precision").value);

    // if the column is not already present
    if (col_index < 0) {
        const th = document.createElement("th");
        th.innerHTML = translated_header;
        th.setAttribute("data-csv-header", header);
        table.querySelector("thead tr").appendChild(th);

        const rows = table.querySelectorAll("tbody tr");
        for (let i = 0; i < data.length; i++) {
            let td = document.createElement("td");
            td.setAttribute("data-unrounded", data[i]);
            td.innerText = format_number(parseFloat(data[i]), precision);

            rows[i].appendChild(td);
        }
    } else {
        const rows = table.querySelectorAll("tbody tr");
        for (let i = 0; i < rows.length; i++) {
            const td = rows[i].querySelectorAll("td")[col_index];
            td.setAttribute("data-unrounded", data[i]);
            td.innerText = format_number(parseFloat(data[i]), precision);
        }
    }
}

function delete_column(header) {
    const table = document.querySelector("#sources-table table");

    let translated_header = header_to_longname[header];

    const ths = table.querySelectorAll("th");
    let col_index = -1;

    for (let i = 1; i < ths.length; i++) {
        if (ths[i].innerHTML == translated_header) {
            col_index = i - 1;
            ths[i].parentElement.removeChild(ths[i]);
            break;
        }
    }

    if (col_index > 0) {
        const rows = table.querySelectorAll("tbody tr");
        for (let i = 0; i < rows.length; i++) {
            const td = rows[i].querySelectorAll("td")[col_index];
            td.parentElement.removeChild(td);
        }
    }
}

function update_inputs() {
    set_defaults();

    if (document.querySelector("#input-single-source-tab").classList.contains("active")) {
        data["sources"]["m_1"] = [parseFloat(document.getElementById("single-primary-mass").value)];
        data["sources"]["m_2"] = [parseFloat(document.getElementById("single-secondary-mass").value)];
        data["sources"]["f_orb"] = [parseFloat(document.getElementById("single-frequency").value)];
        data["sources"]["ecc"] = [parseFloat(document.getElementById("single-eccentricity").value)];
        data["sources"]["dist"] = [parseFloat(document.getElementById("single-distance").value)];

        ["snr", "t_merge", "merged", "total_strain", "total_char_strain"].forEach(param => {
            data["sources"][param] = null;
        });
    }

    data["detector"]["instrument"] = document.getElementById("detector").value;
    data["detector"]["duration"] = parseFloat(document.getElementById("duration").value);
    data["detector"]["approximate_response_function"] = document.getElementById("approximate-response").checked;

    if (document.getElementById("confusion-noise").checked) {
        data["detector"]["confusion_noise_model"] = document.getElementById("confusion-model").value;
    } else {
        data["detector"]["confusion_noise_model"] = "None";
    }

    data["settings"]["gw_lum_tol"] = parseFloat(document.getElementById("gw-lum-tol").value);
    data["settings"]["stat_tol"] = parseFloat(document.getElementById("stat-tol").value);
    data["settings"]["interpolate_sc"] = document.getElementById("interpolate-sc").checked;
    data["settings"]["interpolate_g"] = document.getElementById("interpolate-g").checked;
}

function set_defaults() {
    update_if_blank("duration", 4);
    update_if_blank("gw-lum-tol", 0.05);
    update_if_blank("stat-tol", 0.01);

    // DEVELOPMENT
    update_if_blank("single-primary-mass", 10);
    update_if_blank("single-secondary-mass", 5);
    update_if_blank("single-frequency", 1e-3);
    update_if_blank("single-eccentricity", 0.2);
    update_if_blank("single-distance", 8);
}

function update_if_blank(id, value) {
    const el = document.getElementById(id);
    if (el.value == "") {
        el.value = value;
    }
}

function inject_toast(message, small_text = "", delay = null) {
    const toast_el = document.getElementById("toast-template").cloneNode(true);
    toast_el.id = "";
    toast_el.querySelector(".toast-body").innerText = message;
    toast_el.querySelector(".toast-status").innerText = small_text;
    if (delay != null) {
        toast_el.setAttribute("data-bs-delay", delay);
    }
    toast_el.classList.remove("hide");
    document.querySelector("#toaster").appendChild(toast_el);

    const toast = new bootstrap.Toast(toast_el);
    toast.show();

    animateCSS(toast_el, "bounceInRight");
    return toast_el;
}

function add_loader(el, message) {
    el.innerHTML = `
        <span class='message'></span> <i class="fa fa-spin fa-circle-o-notch"></i>
    `;
    el.querySelector(".message").innerText = message;
}

function alert_user(message, error = null, traceback_doc = null) {
    if (error == null && traceback_doc == null) {
        let toast = inject_toast(message, "", "20000");
        toast.classList.add("bg-danger", "text-white");
        return;
    }

    let toast = inject_toast("", "", "20000");
    toast.classList.add("bg-danger", "text-white");

    let bold = document.createElement("b");
    bold.innerHTML = message;

    let link = document.createElement("a");
    link.classList.add("link-light");
    link.href = "#";
    link.addEventListener("click", function () {
        const new_win = window.open();
        new_win.document.write(traceback_doc);
    });
    link.innerText = "View trackback";

    let p = document.createElement("p");
    p.appendChild(bold);
    p.innerHTML += "<br>";
    p.innerHTML += error;
    p.innerHTML += "<br>";
    p.appendChild(link);

    toast.querySelector(".toast-body").appendChild(p);
    return;
}

function make_calculation(button_selector, method, text_version) {
    if (!enforce_inputs()) {
        return;
    }
    const button = document.querySelector(button_selector);
    const original_html = button.innerHTML;
    add_loader(button, "Calculating...");
    $.ajax({
        type: "POST",
        url: "/tool/" + method,
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        success: function (response) {
            insert_or_update_column(method, response[method]);
            inject_toast(text_version + " calculated! See table for results.", response["runtime"]);
            button.innerHTML = original_html;
            data["sources"][method] = response[method];
        },
        error: function (response) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, "text/html");
            alert_user("Error: " + text_version + " calculation failed", doc.querySelector(".errormsg").innerHTML, response.responseText);
            button.innerHTML = original_html;
        },
    });
}

function enforce_inputs() {
    const required = ["m_1", "m_2", "f_orb", "ecc", "dist"];
    for (let i = 0; i < required.length; i++) {
        if (data["sources"][required[i]] == null) {
            alert_user(
                "Can't complete calculation, you're missing a required input! Make sure you've supplied a value for `" + required[i] + "` (there may be more, this was just the first missing one)."
            );
            return false;
        }
    }
    return true;
}

function download_table() {
    if (document.querySelector("table") == null) {
        alert_user("Download aborted: You haven't added any inputs/performed calculations yet!");
        return;
    }
    let csv_file = "";

    let header_list = [];
    document.querySelectorAll("table thead th").forEach(function (header) {
        header_list.push(header.getAttribute("data-csv-header"));
    });
    csv_file += header_list.join(",") + "\r\n";

    document.querySelectorAll("table tbody tr").forEach(function (row) {
        let row_list = [];
        row.querySelectorAll("th,td").forEach(function (cell) {
            row_list.push(cell.getAttribute("data-unrounded"));
        });
        csv_file += row_list.join(",") + "\r\n";
    });

    let blob = new Blob([csv_file], {type: "text/csv;charset=utf-8;"});
    let link = document.createElement("a");

    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "legwork-online-results.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    inject_toast("Download complete! File is called `legwork-online-results.csv`.");
}

function format_number(number, precision) {
    if ((number > 1e-2 && number < 1e3) || number == 0.0) {
        return number.toFixed(precision);
    } else {
        return number.toExponential(precision);
    }
}
