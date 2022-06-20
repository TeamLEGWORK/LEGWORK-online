from flask import (
    Blueprint, render_template, request, make_response
)
import base64

from legwork.source import Source, VerificationBinaries
from legwork.visualisation import plot_sensitivity_curve
import numpy as np
import astropy.units as u
import time
import os

from matplotlib.patches import Patch
import matplotlib
matplotlib.use('Agg')

bp = Blueprint('tool', __name__)


@bp.route('/')
def index():
    return render_template('home.html')


@bp.route('/tool', methods=("GET", "POST"))
def tool():
    return render_template('tool.html')


@bp.route('/tool/random-sources', methods=["POST"])
def random_sources():
    start = time.time()
    data = request.get_json()

    sources = []

    # just storing locations in case it comes in a weird order (q before m_1)
    m1_loc, q_loc = -1, -1

    # randomly draw each of the variables
    for i, var in enumerate(data["dists"]):
        if var["id"] == "m_1":
            m1_loc = i
        if var["id"] == "q":
            q_loc = i

        sources.append({
            "id": var["id"],
            "values": random_distribution(dist=var["dist"],
                                          count=data["count"],
                                          scale=var["scale"],
                                          min=var["min"],
                                          max=var["max"],
                                          mean=var["mean"],
                                          sigma=var["sigma"])
        })

    # swap out mass ratio for secondary mass
    sources[q_loc]["id"] = "m_2"
    sources[q_loc]["values"] = list(np.multiply(sources[m1_loc]["values"], sources[q_loc]["values"]))

    json = {
        "sources": sources,
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


def random_distribution(dist, count, scale="linear", min=None, max=None, mean=None, sigma=None):
    if scale == "log":
        min, max, mean, sigma = np.log10(min), np.log10(max), np.log10(mean), np.log10(sigma)

    if dist == "uniform":
        vars = np.random.uniform(low=min, high=max, size=count)
    if dist == "normal":
        vars = np.random.normal(loc=mean, scale=sigma, size=count)

    if scale == "log":
        vars = 10**vars

    return list(vars)


@bp.route('/tool/snr', methods=["POST"])
def snr():
    start = time.time()
    data = request.get_json()
    sources = data_to_Source(data)
    snr = sources.get_snr()
    json = {
        "snr": list(snr),
        "max_snr_harmonic": list(sources.max_snr_harmonic.astype(float)),
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/tool/t_merge', methods=["POST"])
def t_merge():
    start = time.time()
    data = request.get_json()
    sources = data_to_Source(data, dont_bother=True)
    sources.get_merger_time()
    json = {
        "t_merge": list(sources.t_merge.to(u.Myr).value),
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/tool/total_strain', methods=["POST"])
def total_strain():
    start = time.time()
    data = request.get_json()
    return total_strains(data, "total_strain", start)


@bp.route('/tool/total_char_strain', methods=["POST"])
def total_char_strain():
    start = time.time()
    data = request.get_json()
    return total_strains(data, "total_char_strain", start)


def total_strains(data, which, start):
    sources = data_to_Source(data)

    strain_vals = np.zeros(sources.n_sources)
    harmonics_required = sources.harmonics_required(sources.ecc)
    harmonic_groups = [(1, 10), (10, 100), (100, 1000), (1000, 10000)]
    for lower, upper in harmonic_groups:
        harm_mask = np.logical_and(harmonics_required > lower, harmonics_required <= upper)
        if harm_mask.any():
            if which == "total_strain":
                specific_strains = sources.get_h_0_n(harmonics=np.arange(1, upper + 1),
                                                     which_sources=harm_mask)
            else:
                specific_strains = sources.get_h_c_n(harmonics=np.arange(1, upper + 1),
                                                     which_sources=harm_mask)
            strain_vals[harm_mask] = specific_strains.sum(axis=1)

    json = {
        which: list(strain_vals),
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/tool/evolve', methods=["POST"])
def evolve():
    start = time.time()
    data = request.get_json()
    sources = data_to_Source(data, dont_bother=True)

    sources.evolve_sources(data["t_evol"] * u.Myr)
    json = {
        "f_orb": list(sources.f_orb.to(u.Hz).value),
        "ecc": list(sources.ecc),
        "t_merge": list(sources.t_merge.to(u.Myr).value),
        "merged": [int(flip) for flip in sources.merged],
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/tool/plot-sc', methods=["POST"])
def plot_sc():
    data = request.get_json()

    counter = 0
    temp_filepath = bp.root_path + f"/static/img/tmp/plot_{counter}.png"
    while os.path.exists(temp_filepath):
        counter += 1
        temp_filepath = bp.root_path + f"/static/img/tmp/plot_{counter}.png"

    frequency_range = np.logspace(np.log10(data["plot_params"]["frequency_range"][0]),
                                  np.log10(data["plot_params"]["frequency_range"][1]),
                                  1000) * u.Hz

    confusion_noise = None if data["detector"]["confusion_noise_model"] == "None"\
        else data["detector"]["confusion_noise_model"]
    fig, ax = plot_sensitivity_curve(frequency_range=frequency_range,
                                     fill=bool(data["plot_params"]["fill"]),
                                     color=data["plot_params"]["fill_colour"],
                                     alpha=data["plot_params"]["fill_opacity"],
                                     linewidth=data["plot_params"]["linewidth"],
                                     show=False, label="Sensitivity Curve",
                                     instrument=data["detector"]["instrument"],
                                     t_obs=data["detector"]["duration"] * u.yr,
                                     approximate_R=bool(data["detector"]["approximate_response_function"]),
                                     confusion_noise=confusion_noise)

    sdist = None
    if bool(data["plot_params"]["include_sources"]):
        sources = data_to_Source(data)

        if sources.snr is None:
            sources.get_snr()

        sdist = data["plot_params"]["sources_dist"]
        if sdist in ["combined", "scatter"]:
            sources.plot_sources_on_sc(fig=fig, ax=ax, show=False, disttype="scatter",
                                       color=data["plot_params"]["sources_colour"],
                                       scatter_s=1 if sdist == "combined" else None, label="Sources")

        if sdist in ["combined", "kde"] and sources.n_sources > 1:
            sources.plot_sources_on_sc(fig=fig, ax=ax, show=False, disttype="kde",
                                       fill=True, color=data["plot_params"]["sources_colour"],
                                       zorder=2, bw_adjust=0.9, label="SourcesKDE")

    if bool(data["plot_params"]["include_vbs"]):
        vbs = VerificationBinaries()
        vbs.snr = vbs.true_snr
        vbs.plot_sources_on_sc(fig=fig, ax=ax, show=False,
                               disttype="scatter", scatter_s=100,
                               edgecolor="grey", color="none", marker="*",
                               label="Verification Binaries (Kupfer+18)", zorder=3)

    if bool(data["plot_params"]["legend"]):
        # this is where life gets hacky
        handles, labels = ax.get_legend_handles_labels()

        # don't show the label for scatter plots if it is combined
        if sdist == "combined":
            ind = labels.index("Sources")
            del handles[ind]
            del labels[ind]

        # fix the KDE handle since Seaborn seems to have a bug
        if "SourcesKDE" in labels:
            ind = labels.index("SourcesKDE")
            handles[ind] = Patch(facecolor=handles[ind].get_facecolor()[0])
            labels[ind] = "Sources"
        ax.legend(handles=handles, labels=labels, fontsize=16)

    fig.savefig(temp_filepath, format="png", bbox_inches="tight")

    with open(temp_filepath, "rb") as f:
        image_binary = f.read()

    os.remove(temp_filepath)

    response = make_response(base64.b64encode(image_binary))
    response.headers.set('Content-Type', 'image/png')
    response.headers.set('Content-Disposition', 'attachment', filename='image.png')
    return response


@bp.route('/tool/plot-oned', methods=["POST"])
def plot_oned():
    data = request.get_json()

    counter = 0
    temp_filepath = bp.root_path + f"/static/img/tmp/plot_{counter}.png"
    while os.path.exists(temp_filepath):
        counter += 1
        temp_filepath = bp.root_path + f"/static/img/tmp/plot_{counter}.png"

    sources = data_to_Source(data)

    if data["plot_params"]["disttype"] == "hist":
        bins = "fd" if data["plot_params"]["bins"] == "auto" else int(data["plot_params"]["bins"])
        fig, ax = sources.plot_source_variables(xstr=data["plot_params"]["xstr"], show=False, bins=bins,
                                                histtype=data["plot_params"]["histtype"],
                                                color=data["plot_params"]["colour"],
                                                linewidth=data["plot_params"]["linewidth"],
                                                log_scale=data["plot_params"]["scale"] == "log")
    elif data["plot_params"]["disttype"] == "kde":
        fig, ax = sources.plot_source_variables(xstr=data["plot_params"]["xstr"], show=False, disttype="kde",
                                                bw_adjust=data["plot_params"]["bw_adjust"],
                                                color=data["plot_params"]["colour"],
                                                linewidth=data["plot_params"]["linewidth"],
                                                log_scale=data["plot_params"]["scale"] == "log")
    else:
        fig, ax = sources.plot_source_variables(xstr=data["plot_params"]["xstr"], show=False, disttype="ecdf",
                                                stat=data["plot_params"]["stat"],
                                                color=data["plot_params"]["colour"],
                                                linewidth=data["plot_params"]["linewidth"],
                                                log_scale=data["plot_params"]["scale"] == "log")

    fig.savefig(temp_filepath, format="png", bbox_inches="tight")

    with open(temp_filepath, "rb") as f:
        image_binary = f.read()

    os.remove(temp_filepath)

    response = make_response(base64.b64encode(image_binary))
    response.headers.set('Content-Type', 'image/png')
    response.headers.set('Content-Disposition', 'attachment', filename='image.png')
    return response


@bp.route('/tool/plot-twod', methods=["POST"])
def plot_twod():
    data = request.get_json()

    counter = 0
    temp_filepath = bp.root_path + f"/static/img/tmp/plot_{counter}.png"
    while os.path.exists(temp_filepath):
        counter += 1
        temp_filepath = bp.root_path + f"/static/img/tmp/plot_{counter}.png"

    sources = data_to_Source(data)

    log_scale = [
        data["plot_params"]["xscale"] == "log",
        data["plot_params"]["yscale"] == "log"
    ]

    if data["plot_params"]["disttype"] == "scatter":
        fig, ax = sources.plot_source_variables(xstr=data["plot_params"]["xstr"],
                                                ystr=data["plot_params"]["ystr"],
                                                show=False, scatter_s=data["plot_params"]["scatter_s"],
                                                marker=data["plot_params"]["marker"],
                                                alpha=data["plot_params"]["alpha"],
                                                color=data["plot_params"]["colour"],
                                                log_scale=log_scale)
    else:
        fig, ax = sources.plot_source_variables(xstr=data["plot_params"]["xstr"],
                                                ystr=data["plot_params"]["ystr"], show=False, disttype="kde",
                                                bw_adjust=data["plot_params"]["bw_adjust"],
                                                fill=data["plot_params"]["fill"],
                                                color=data["plot_params"]["colour"],
                                                log_scale=log_scale)

    fig.savefig(temp_filepath, format="png", bbox_inches="tight")

    with open(temp_filepath, "rb") as f:
        image_binary = f.read()

    os.remove(temp_filepath)

    response = make_response(base64.b64encode(image_binary))
    response.headers.set('Content-Type', 'image/png')
    response.headers.set('Content-Disposition', 'attachment', filename='image.png')
    return response


@bp.route('/about')
def about():
    return render_template('about.html')


def data_to_Source(data, dont_bother=False):
    confusion_noise = None if data["detector"]["confusion_noise_model"] == "None"\
        else data["detector"]["confusion_noise_model"]
    sc_params = {
        "instrument": data["detector"]["instrument"],
        "t_obs": float(data["detector"]["duration"]) * u.yr,
        "approximate_R": bool(data["detector"]["approximate_response_function"]),
        "confusion_noise": confusion_noise
    }

    interpolate_g = False if dont_bother else bool(data["settings"]["interpolate_g"])

    sources = Source(m_1=data["sources"]["m_1"] * u.Msun,
                     m_2=data["sources"]["m_2"] * u.Msun,
                     f_orb=data["sources"]["f_orb"] * u.Hz,
                     ecc=data["sources"]["ecc"],
                     dist=data["sources"]["dist"] * u.kpc,
                     gw_lum_tol=float(data["settings"]["gw_lum_tol"]),
                     stat_tol=float(data["settings"]["stat_tol"]),
                     interpolate_g=interpolate_g,
                     interpolate_sc=bool(data["settings"]["interpolate_sc"]),
                     sc_params=sc_params)

    if data["sources"]["snr"] is not None:
        sources.snr = np.array(data["sources"]["snr"])

    if data["sources"]["max_snr_harmonic"] is not None:
        sources.max_snr_harmonic = np.array(data["sources"]["max_snr_harmonic"])

    if data["sources"]["t_merge"] is not None:
        sources.t_merge = data["sources"]["t_merge"] * u.Myr

    if data["sources"]["merged"] is not None:
        sources.merged = np.array(data["sources"]["merged"]).astype(bool)
    return sources
