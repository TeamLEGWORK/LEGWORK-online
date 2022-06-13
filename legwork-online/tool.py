from flask import (
    Blueprint, flash, g, redirect, render_template, request, url_for
)
from werkzeug.exceptions import abort

import legwork
import astropy.units as u

import os
import matplotlib
matplotlib.use('Agg')

bp = Blueprint('tool', __name__)


# def source_to_json(sources):
#     single_source = source.n_sources == 1

#     sources_dict = {}
#     if single_source:
#         sources_dict = {
#             "m_1": sources.m_1.to(u.Msun).value[0],
#             "m_2": sources.m_2.to(u.Msun).value[0],
#             "f_orb": sources.f_orb.to(u.mHz).value[0],
#             "ecc": sources.ecc[0],
#             "dist": sources.dist.to(u.kpc).value[0],
#             "t_merge": sources.t_merge.to(u.yr).value[0],
#             "h_0": sources.m_1.to(u.Msun).value[0],
#             "h_c": sources.m_1.to(u.Msun).value[0],
#             "snr": sources.snr.value[0]
#         }
#     else:


#     json = {
#         "single_source": single_source,
#         "sources": sources_dict,
#         "detector": {
#             "instrument": sources._sc_params["instrument"],
#             "duration": sources._sc_params["t_obs"],
#             "approximate_response_function": sources._sc_params["approximate_R"],
#             "confusion_noise_model": sources._sc_pararms["confusion_noise"]
#         },
#         "settings": {
#             "gw_lum_tol": sources._gw_lum_tol,
#             "stat_tol": sources.stat_tol,
#             "interpolate_g": false,
#             "interpolate_sc": true
#         }
#     }
#     return json


@bp.route('/')
def index():
    return render_template('home.html')


@bp.route('/tool', methods=("GET", "POST"))
def tool():
    if request.method == "GET":
        return render_template('tool.html')
    else:
        data = request.get_json()
        sources = data_to_Source(data)

        sources.get_snr()

        json = {
            "snr": list(sources.snr)
        }

        return json


@bp.route('/about')
def about():
    return render_template('about.html')


def data_to_Source(data):
    sources = legwork.source.Source(m_1=float(data["sources"]["m_1"]) * u.Msun,
                                    m_2=float(data["sources"]["m_2"]) * u.Msun,
                                    f_orb=float(data["sources"]["f_orb"]) * u.mHz,
                                    ecc=float(data["sources"]["ecc"]),
                                    dist=float(data["sources"]["dist"]) * u.kpc,
                                    gw_lum_tol=float(data["settings"]["gw_lum_tol"]),
                                    stat_tol=float(data["settings"]["stat_tol"]),
                                    interpolate_g=bool(data["settings"]["interpolate_g"]),
                                    interpolate_sc=bool(data["settings"]["interpolate_sc"]),
                                    sc_params={
                                        "instrument": data["detector"]["instrument"],
                                        "t_obs": float(data["detector"]["duration"]) * u.yr,
                                        "approximate_R": bool(data["detector"]["approximate_response_function"]),
                                        "confusion_noise": None if data["detector"]["confusion_noise_model"] == "None" else data["detector"]["confusion_noise_model"]
                                    })
    return sources