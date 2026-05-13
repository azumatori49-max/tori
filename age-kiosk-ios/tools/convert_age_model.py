#!/usr/bin/env python3
"""
Core ML への年齢推定モデル変換レシピ。

このスクリプトは「日本人/東アジア人を多めに含む」公開モデルを
Core ML (`AgeNet.mlmodel`) に書き出す例。完成した `.mlmodel` を
AgeKiosk/Resources/ 配下に置き、Xcode のターゲットに追加すれば
アプリ側で自動的にロードされる。

選択肢 (2026 年現在で実用しやすいもの):

  1) AFAD (Asian Face Age Dataset) で学習したオープンな ResNet を変換
       https://github.com/afad-dataset/tarball
     東アジア人 16 万枚、15-40 歳中心。日本人キオスク用途には最有力。

  2) UTKFace の East-Asian サブセット (ethnicity == 2) のみで fine-tune
     ── 学習スクリプトは別途必要。
     幅広い年齢 (0-100) をカバーしたい場合に推奨。

  3) IMDB-WIKI 学習済みの DEX (Rothe et al.) を変換し、推論時に
     `JapaneseCalibrator` 側で日本人向けオフセット補正する (最低限の手当)

下記は (3) のレシピ (PyTorch -> Core ML)。
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
import torch.nn as nn
import torchvision.models as tv
import coremltools as ct


def build_dex_resnet50(num_age_buckets: int = 101) -> nn.Module:
    """101-way (0..100 歳) softmax + 期待値で年齢を回帰する DEX 型ヘッド。"""
    backbone = tv.resnet50(weights=None)
    in_features = backbone.fc.in_features
    backbone.fc = nn.Linear(in_features, num_age_buckets)
    return backbone


def load_weights(model: nn.Module, weights_path: Path) -> nn.Module:
    state = torch.load(weights_path, map_location="cpu")
    state = state.get("state_dict", state)
    # キーの prefix 揺れに耐性
    state = {k.replace("module.", ""): v for k, v in state.items()}
    model.load_state_dict(state, strict=False)
    model.eval()
    return model


class AgeRegressionWrapper(nn.Module):
    """Softmax * range(0..100) の期待値を出力する。"""

    def __init__(self, base: nn.Module, num_buckets: int = 101) -> None:
        super().__init__()
        self.base = base
        self.register_buffer(
            "ages",
            torch.arange(0, num_buckets, dtype=torch.float32).view(1, num_buckets),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        logits = self.base(x)
        probs = torch.softmax(logits, dim=1)
        age = (probs * self.ages).sum(dim=1, keepdim=False)
        return age  # shape: (N,)


def convert(weights: Path, output: Path, input_size: int = 224) -> None:
    base = build_dex_resnet50()
    base = load_weights(base, weights)
    wrapped = AgeRegressionWrapper(base).eval()

    example = torch.rand(1, 3, input_size, input_size)
    traced = torch.jit.trace(wrapped, example)

    mlmodel = ct.convert(
        traced,
        inputs=[
            ct.ImageType(
                name="image",
                shape=(1, 3, input_size, input_size),
                scale=1.0 / 255.0,
                bias=[0.0, 0.0, 0.0],
                color_layout=ct.colorlayout.RGB,
            )
        ],
        outputs=[ct.TensorType(name="age")],
        compute_units=ct.ComputeUnit.ALL,
        convert_to="mlprogram",
        minimum_deployment_target=ct.target.iOS16,
    )

    mlmodel.author = "AgeKiosk"
    mlmodel.short_description = "DEX-style age regression (0..100 expected value)."
    mlmodel.input_description["image"] = "Face crop (224x224, RGB)."
    mlmodel.output_description["age"] = "Predicted age in years (float)."

    output.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(output))
    print(f"wrote {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True, help=".pth file")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("../AgeKiosk/Resources/AgeNet.mlmodel"),
    )
    parser.add_argument("--input-size", type=int, default=224)
    args = parser.parse_args()
    convert(args.weights, args.output, args.input_size)
