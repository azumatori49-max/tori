#!/usr/bin/env python3
"""
Download and convert the InsightFace genderage model to TFLite format.

Produces: assets/models/age_model.tflite
  Input:  [1, 96, 96, 3] float32 NHWC, values in [0, 1]
  Output: [1, 3] float32 → [female_logit, male_logit, age/100]
  Size:   ~1.3 MB

Requirements:
  pip install insightface onnx onnx2tf tensorflow-cpu

Usage:
  python3 scripts/prepare_model.py
"""

import os
import subprocess
import sys
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(SCRIPT_DIR, '..', 'assets', 'models', 'age_model.tflite')
OUT_PATH = os.path.normpath(OUT_PATH)


def check_deps():
    missing = []
    for pkg in ('insightface', 'onnx', 'onnx2tf', 'tensorflow'):
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"Missing packages: {', '.join(missing)}")
        print(f"Install with: pip install {' '.join(missing)} onnxruntime")
        sys.exit(1)


def download_onnx():
    import insightface

    model_dir = os.path.expanduser('~/.insightface/models/buffalo_s')
    onnx_path = os.path.join(model_dir, 'genderage.onnx')
    if os.path.exists(onnx_path):
        print(f"ONNX model already at {onnx_path}")
        return onnx_path

    print("Downloading InsightFace buffalo_s model pack (~125 MB)...")
    app = insightface.app.FaceAnalysis(name='buffalo_s')
    app.prepare(ctx_id=-1)
    if not os.path.exists(onnx_path):
        raise FileNotFoundError(f"Expected {onnx_path} after download")
    return onnx_path


def convert_to_tflite(onnx_path: str, out_path: str):
    import onnx2tf  # noqa: F401 — just verify import works

    tmp_dir = '/tmp/genderage_tf_out'
    os.makedirs(tmp_dir, exist_ok=True)

    print("Converting ONNX → TFLite (float32)...")
    result = subprocess.run(
        ['onnx2tf', '-i', onnx_path, '-o', tmp_dir],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(result.stderr[-2000:])
        raise RuntimeError('onnx2tf conversion failed')

    src = os.path.join(tmp_dir, 'genderage_float32.tflite')
    if not os.path.exists(src):
        candidates = [f for f in os.listdir(tmp_dir) if f.endswith('.tflite')]
        if not candidates:
            raise FileNotFoundError(f"No .tflite file in {tmp_dir}")
        src = os.path.join(tmp_dir, candidates[0])

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    shutil.copy(src, out_path)
    print(f"Model saved → {out_path}  ({os.path.getsize(out_path):,} bytes)")


def verify(out_path: str):
    import tensorflow as tf
    import numpy as np

    interp = tf.lite.Interpreter(model_path=out_path)
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    print(f"Verified — input: {inp['shape']} {inp['dtype'].__name__}, "
          f"output: {out['shape']} {out['dtype'].__name__}")

    dummy = np.random.rand(1, 96, 96, 3).astype(np.float32)
    interp.set_tensor(inp['index'], dummy)
    interp.invoke()
    result = interp.get_tensor(out['index'])[0]
    age = round(result[2] * 100)
    print(f"Test inference OK — dummy age estimate: {age}")


if __name__ == '__main__':
    check_deps()
    onnx_path = download_onnx()
    convert_to_tflite(onnx_path, OUT_PATH)
    verify(OUT_PATH)
    print('\nDone! Set CONFIG.DEV_MOCK_ESTIMATOR = false to enable real age estimation.')
