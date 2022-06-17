from flask import (
    Blueprint, render_template, request, make_response
)
import base64

from legwork.source import Source, VerificationBinaries
from legwork.visualisation import *
import numpy as np
import astropy.units as u
import time
import os

import matplotlib
matplotlib.use('Agg')

bp = Blueprint('tool', __name__)


@bp.route('/')
def index():
    return render_template('home.html')


@bp.route('/tool', methods=("GET", "POST"))
def tool():
    return render_template('tool.html')


@bp.route('/tool/snr', methods=["POST"])
def snr():
    start = time.time()
    data = request.get_json()
    sources = data_to_Source(data)
    json = {
        "snr": list(sources.get_snr()),
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
                specific_strains = sources.get_h_0_n(harmonics=np.arange(1, upper + 1), which_sources=harm_mask)
            else:
                specific_strains = sources.get_h_c_n(harmonics=np.arange(1, upper + 1), which_sources=harm_mask)
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

    # TODO: make this choose an unused file_path
    temp_filepath = bp.root_path + "/static/img/tmp/test.png"

    if bool(data["plot_params"]["include_sources"]):
        sources = data_to_Source(data, dont_bother=True)
    else:
        print(data["plot_params"])
        
        frequency_range = np.logspace(np.log10(data["plot_params"]["frequency_range"][0]),
                                      np.log10(data["plot_params"]["frequency_range"][1]),
                                      1000) * u.Hz
        fig, ax = plot_sensitivity_curve(frequency_range=frequency_range, show=False)
    fig.savefig(temp_filepath)

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
    confusion_noise = None if data["detector"]["confusion_noise_model"] == "None" else data["detector"]["confusion_noise_model"]
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

    if data["sources"]["t_merge"] is not None:
        sources.t_merge = data["sources"]["t_merge"] * u.Myr

    if data["sources"]["merged"] is not None:
        sources.merged = np.array(data["sources"]["merged"]).astype(bool)
    return sources
