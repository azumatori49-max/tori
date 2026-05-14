#!/usr/bin/env python3
"""
Android (TFLite) 用の年齢推定モデル変換レシピ。

このスクリプトは、PyTorch 学習済みの年齢推定モデルを
TensorFlow Lite (`age_net.tflite`) に書き出す例。
完成した `.tflite` を `app/src/main/assets/age_net.tflite` に置けば、
アプリ側で自動的にロードされる。

おすすめのデータセット (日本人キオスク用途):
  1) AFAD (Asian Face Age Dataset) — 東アジア人 16 万枚、15-40 歳中心
  2) UTKFace の East-Asian サブセット (ethnicity == 2) — 0-100 歳カバー
  3) IMDB-WIKI 学習済みの DEX を変換 + JapaneseCalibrator で補正

下記は PyTorch (DEX/ResNet50, 101-way softmax) を TFLite に変換するレシピ。
出力モデルは [1, 101] の softmax で、アプリ側で期待値を計算して年齢化する。
回帰モデル (スカラー出力) でも AgeEstimator はそのまま扱える。
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
import torch.nn as nn
import torchvision.models as tv
import numpy as np

# ONNX を経由して TFLite に変換する標準ルート。
# 必要: torch, onnx, onnx-tf, tensorflow
import onnx
from onnx_tf.backend import prepare
import tensorflow as tf


def build_dex_resnet50(num_age_buckets: int = 101) -> nn.Module:
    backbone = tv.resnet50(weights=None)
    in_features = backbone.fc.in_features
    backbone.fc = nn.Linear(in_features, num_age_buckets)
    return backbone


def load_weights(model: nn.Module, weights_path: Path) -> nn.Module:
    state = torch.load(weights_path, map_location="cpu")
    state = state.get("state_dict", state)
    state = {k.replace("module.", ""): v for k, v in state.items()}
    model.load_state_dict(state, strict=False)
    model.eval()
    return model


class WithSoftmax(nn.Module):
    def __init__(self, base: nn.Module):
        super().__init__()
        self.base = base

    def forward(self, x):
        return torch.softmax(self.base(x), dim=1)


def convert(weights: Path, output: Path, input_size: int = 224) -> None:
    base = build_dex_resnet50()
    base = load_weights(base, weights)
    model = WithSoftmax(base).eval()

    example = torch.rand(1, 3, input_size, input_size)
    onnx_path = output.with_suffix(".onnx")
    torch.onnx.export(
        model, example, str(onnx_path),
        input_names=["image"], output_names=["probs"],
        dynamic_axes=None, opset_version=13,
    )

    tf_path = onnx_path.with_suffix(".tf")
    prepare(onnx.load(str(onnx_path))).export_graph(str(tf_path))

    converter = tf.lite.TFLiteConverter.from_saved_model(str(tf_path))
    converter.optimizations = [tf.lite.Optimize.DEFAULT]  # 動的量子化で軽量化
    tflite = converter.convert()

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(tflite)
    print(f"wrote {output} ({len(tflite) / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True, help=".pth file")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("../app/src/main/assets/age_net.tflite"),
    )
    parser.add_argument("--input-size", type=int, default=224)
    args = parser.parse_args()
    convert(args.weights, args.output, args.input_size)
