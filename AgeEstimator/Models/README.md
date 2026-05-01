# Models

Drop the trained CoreML package here. The app searches the bundle for any of
these names (in order):

1. `AgeNetJP.mlpackage` / `AgeNetJP.mlmodel`
2. `AgeNet.mlpackage` / `AgeNet.mlmodel`
3. `AgeEstimator.mlpackage` / `AgeEstimator.mlmodel`

If none is present, debug builds fall back to a random placeholder so the
camera UI is still runnable; release builds will simply not return a
prediction.

## Producing `AgeNetJP.mlpackage`

```
cd ../Scripts
python finetune_japanese.py \
    --afad /data/AFAD-Full \
    --aaf  /data/All-Age-Faces \
    --megaage /data/megaage_asian \
    --out  ../Models/AgeNetJP.mlpackage
```

After training, validate on a held-out Japanese split and update the bias
table:

```
python measure_calibration.py \
    --model ../Models/AgeNetJP.mlpackage \
    --labels /data/jp_val/labels.csv
```

The script prints a Swift literal you paste into
`AgeEstimator/ML/JapaneseCalibration.swift`'s `default.decadeOffsets`.

## Privacy

The model runs entirely on-device through CoreML's Neural Engine. No image,
embedding, or prediction leaves the phone — see
`AgeEstimator/Resources/Info.plist` (`NSCameraUsageDescription`).
