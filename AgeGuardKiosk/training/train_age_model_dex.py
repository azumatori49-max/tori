"""
🥇 High-accuracy age model: EfficientNetB0 + DEX + AFAD + UTKFace.

Designed for Kaggle Notebooks (GPU T4 / P100). Runtime: ~4-5 hours.

Strategy:
- DEX (Deep EXpectation): treat age as a 101-class classification (0..100),
  trained with soft Gaussian labels. At inference, take softmax expectation.
  Outperforms direct regression on age estimation benchmarks.
- AFAD (Asian Face Age Dataset, 165k images) is the primary training signal
  for Japanese kiosk accuracy. UTKFace (24k) adds diversity.
- EfficientNetB0 backbone: stronger than MobileNetV2 with similar inference
  cost.

Output: /kaggle/working/age_model.tflite
  - input  : float32 [1, 224, 224, 3], RGB, normalized 0..1
  - output : float32 [1, 101] softmax probabilities over ages 0..100

These I/O specs are already supported by AgeEstimator.kt (the classification
branch computes softmax expectation), so the file drops in with no code change.
"""

import glob
import os
import re

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras import applications, callbacks, layers, models

# ---------- Config ----------
# Add datasets to your Kaggle notebook via "+ Add Data":
#   1. Search "AFAD" — pick a dataset with structure <age>/<gender>/*.jpg
#   2. Search "UTKFace New" by jangedoo
# If paths differ from below, just edit these two constants.
AFAD_DIR = "/kaggle/input/afad-full/AFAD-Full"
UTKFACE_DIR = "/kaggle/input/utkface-new/UTKFace"

IMG_SIZE = 224
NUM_CLASSES = 101
BATCH = 96
EPOCHS_HEAD = 5
EPOCHS_FT = 12
SIGMA = 2.0  # Gaussian label smoothing width (years)
SEED = 42
OUTPUT_PATH = "/kaggle/working/age_model.tflite"


# ---------- Dataset collectors ----------
def collect_afad(root: str):
    """AFAD-Full structure: <age>/<gender_id>/*.jpg (gender_id is 111 or 112)."""
    if not os.path.isdir(root):
        print(f"[WARN] AFAD not found at {root}, skipping.")
        return [], []
    paths, ages = [], []
    for age_dir in sorted(os.listdir(root)):
        if not age_dir.isdigit():
            continue
        age = int(age_dir)
        if not (0 < age < 100):
            continue
        age_path = os.path.join(root, age_dir)
        for entry in os.listdir(age_path):
            sub = os.path.join(age_path, entry)
            if os.path.isdir(sub):
                paths.extend(glob.glob(os.path.join(sub, "*.jpg")))
                paths.extend(glob.glob(os.path.join(sub, "*.jpeg")))
            elif entry.lower().endswith((".jpg", ".jpeg")):
                paths.append(sub)
        # ages list is built lazily below to keep alignment
    # Rebuild aligned (path, age) pairs by re-walking
    paths.clear()
    ages.clear()
    for age_dir in sorted(os.listdir(root)):
        if not age_dir.isdigit():
            continue
        age = int(age_dir)
        if not (0 < age < 100):
            continue
        for p in glob.glob(os.path.join(root, age_dir, "**", "*.jpg"), recursive=True):
            paths.append(p)
            ages.append(age)
    print(f"AFAD: {len(paths)} images")
    return paths, ages


def collect_utkface(root: str):
    """UTKFace filename: [age]_[gender]_[race]_[datetime].jpg"""
    if not os.path.isdir(root):
        print(f"[WARN] UTKFace not found at {root}, skipping.")
        return [], []
    paths, ages = [], []
    for p in sorted(glob.glob(os.path.join(root, "*.jpg"))):
        m = re.match(r"(\d+)_", os.path.basename(p))
        if not m:
            continue
        age = int(m.group(1))
        if not (0 < age < 100):
            continue
        paths.append(p)
        ages.append(age)
    print(f"UTKFace: {len(paths)} images")
    return paths, ages


afad_p, afad_y = collect_afad(AFAD_DIR)
utk_p, utk_y = collect_utkface(UTKFACE_DIR)
paths = afad_p + utk_p
ages = afad_y + utk_y
assert len(paths) > 1000, (
    f"Only {len(paths)} images found. Check dataset paths in the script."
)
print(f"Combined dataset: {len(paths)} images")

train_p, val_p, train_y, val_y = train_test_split(
    paths, ages, test_size=0.05, random_state=SEED,
)


# ---------- tf.data pipeline ----------
def gaussian_label(age):
    """Smooth integer age into a Gaussian distribution over 101 bins."""
    age = tf.cast(age, tf.float32)
    bins = tf.range(NUM_CLASSES, dtype=tf.float32)
    g = tf.exp(-0.5 * tf.square((bins - age) / SIGMA))
    return g / tf.reduce_sum(g)


def load_image(path, age):
    img = tf.io.read_file(path)
    img = tf.image.decode_jpeg(img, channels=3)
    img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
    img = tf.cast(img, tf.float32) / 255.0
    return img, gaussian_label(age)


def augment(img, label):
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_brightness(img, 0.1)
    img = tf.image.random_contrast(img, 0.9, 1.1)
    img = tf.image.random_saturation(img, 0.9, 1.1)
    img = tf.clip_by_value(img, 0.0, 1.0)
    return img, label


def make_ds(paths, ys, training: bool):
    ds = tf.data.Dataset.from_tensor_slices((list(paths), list(ys)))
    if training:
        ds = ds.shuffle(8192, seed=SEED, reshuffle_each_iteration=True)
    ds = ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        ds = ds.map(augment, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(BATCH).prefetch(tf.data.AUTOTUNE)


train_ds = make_ds(train_p, train_y, training=True)
val_ds = make_ds(val_p, val_y, training=False)


# ---------- Custom metric ----------
bins_const = tf.constant(np.arange(NUM_CLASSES, dtype=np.float32))


def expected_age_mae(y_true_soft, y_pred):
    true_age = tf.reduce_sum(y_true_soft * bins_const, axis=-1)
    pred_age = tf.reduce_sum(y_pred * bins_const, axis=-1)
    return tf.reduce_mean(tf.abs(true_age - pred_age))


# ---------- Model ----------
base = applications.EfficientNetB0(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet",
)
base.trainable = False

inputs = layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
# Model accepts 0..1 (so the Android side keeps its simple normalization).
# EfficientNet expects 0..255 inputs; rescale internally.
x = layers.Rescaling(255.0)(inputs)
x = base(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.3)(x)
x = layers.Dense(256, activation="relu")(x)
x = layers.Dropout(0.2)(x)
outputs = layers.Dense(NUM_CLASSES, activation="softmax")(x)
model = models.Model(inputs, outputs)
model.summary()

cb = [
    callbacks.ReduceLROnPlateau(
        monitor="val_expected_age_mae", factor=0.5, patience=2, mode="min", min_lr=1e-7,
    ),
    callbacks.EarlyStopping(
        monitor="val_expected_age_mae", patience=4, mode="min", restore_best_weights=True,
    ),
]

# ---------- Stage 1: head only ----------
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss="kl_divergence",
    metrics=[expected_age_mae],
)
print("\n=== Stage 1: head only ===")
model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD, callbacks=cb)

# ---------- Stage 2: fine-tune top of backbone ----------
base.trainable = True
for layer in base.layers[:-50]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-5),
    loss="kl_divergence",
    metrics=[expected_age_mae],
)
print("\n=== Stage 2: fine-tune ===")
model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FT, callbacks=cb)

# ---------- Final evaluation ----------
val_loss, val_mae = model.evaluate(val_ds)
print(f"\nFinal validation expected-age MAE: {val_mae:.2f} years")

# ---------- Export TFLite ----------
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()
with open(OUTPUT_PATH, "wb") as f:
    f.write(tflite_model)
size_mb = len(tflite_model) / 1024 / 1024
print(f"Wrote {OUTPUT_PATH} ({size_mb:.1f} MB)")
