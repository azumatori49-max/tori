"""
Measure per-decade bias of the trained CoreML model on a held-out Japanese
validation set, then emit Swift literals you can paste into
`AgeEstimator/ML/JapaneseCalibration.swift` (`decadeOffsets`).

Usage:
    python measure_calibration.py \\
        --model ../Models/AgeNetJP.mlpackage \\
        --images path/to/jp_val/*.jpg \\
        --labels path/to/jp_val/labels.csv
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np
import coremltools as ct
from PIL import Image


def expected_age(prob: np.ndarray) -> float:
    years = np.arange(prob.shape[-1])
    return float((prob * years).sum() / prob.sum())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--labels", type=Path, required=True,
                   help="CSV with columns: filepath,age")
    args = p.parse_args()

    mlmodel = ct.models.MLModel(str(args.model))
    raw_by_decade: dict[int, list[float]] = {i: [] for i in range(10)}
    truth_by_decade: dict[int, list[float]] = {i: [] for i in range(10)}

    with args.labels.open() as f:
        for row in csv.DictReader(f):
            img = Image.open(row["filepath"]).convert("RGB").resize((224, 224))
            out = mlmodel.predict({"image": img})
            prob = np.array(list(out.values())[0]).flatten()
            raw = expected_age(prob)
            true = float(row["age"])
            d = min(9, int(true // 10))
            raw_by_decade[d].append(raw)
            truth_by_decade[d].append(true)

    offsets = []
    print("decade  n   mean(raw)  mean(true)  offset")
    for d in range(10):
        if not raw_by_decade[d]:
            offsets.append(0.0)
            continue
        rm = np.mean(raw_by_decade[d])
        tm = np.mean(truth_by_decade[d])
        offsets.append(round(tm - rm, 2))
        print(f" {d*10:>3}+   {len(raw_by_decade[d]):>3}    {rm:6.2f}     {tm:6.2f}    {tm - rm:+6.2f}")

    print()
    print("Paste into JapaneseCalibration.default.decadeOffsets:")
    print("[" + ", ".join(f"{o: .2f}" for o in offsets) + "]")


if __name__ == "__main__":
    main()
