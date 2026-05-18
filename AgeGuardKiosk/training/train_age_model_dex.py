"""
🥇 High-accuracy age model with child-balanced training.

Designed for Kaggle Notebooks (GPU T4 / P100). Runtime: ~1.5-2 hours.

Strategy:
- DEX (Deep EXpectation): 101-class classification with Gaussian-smoothed
  labels, softmax expectation at inference.
- AFAD provides adult Asian-face signal but has *no* children (ages 15-39
  only), so we filter it to age >= 18 and rely on UTKFace for ages 0-17 and
  40+.
- UTKFace minors (age < 18) are heavily oversampled so the model actually
  learns "this face is 8 years old, not 20".
- Inverse-frequency sample weighting balances the rest of the spectrum so
  rare ages (very young, very old) get more learning signal.

Output: /kaggle/working/age_model.tflite
  - input  : float32 [1, 224, 224, 3], RGB, normalized 0..1
  - output : float32 [1, 101] softmax probabilities over ages 0..100

These I/O specs are unchanged from the previous script, so the TFLite drops
straight into AgeGuardKiosk/app/src/main/assets/ with no app code changes.
"""

import glob
import math
import os
import re
from collections import Counter

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras import applications, callbacks, layers, models

# ---------- Config ----------
AFAD_DIR = "/kaggle/input/datasets/lyk1652/afad-full/AFAD-Full"
UTKFACE_DIR = "/kaggle/input/datasets/jangedoo/utkface-new/UTKFace"

IMG_SIZE = 224
NUM_CLASSES = 101
BATCH = 96
EPOCHS_HEAD = 5
EPOCHS_FT = 12
SIGMA = 2.0
SEED = 42
OUTPUT_PATH = "/kaggle/working/age_model.tflite"

# Bias-fighting knobs:
AFAD_MIN_AGE = 18           # drop AFAD samples younger than this
MINOR_AGE_CUTOFF = 18       # UTKFace samples below this are oversampled
MINOR_OVERSAMPLE = 5        # how many times to replicate each child sample
WEIGHT_FLOOR = 100          # cap inverse-frequency weighting to avoid extreme values


# ---------- Dataset collectors ----------
def collect_afad(root: str):
    if not os.path.isdir(root):
        print(f"[WARN] AFAD not found at {root}, skipping.")
        return [], []
    paths, ages = [], []
    for age_dir in sorted(os.listdir(root)):
        if not age_dir.isdigit():
            continue
        age = int(age_dir)
        if age < AFAD_MIN_AGE or age >= 100:
            continue
        for p in glob.glob(os.path.join(root, age_dir, "**", "*.jpg"), recursive=True):
            paths.append(p)
            ages.append(age)
    print(f"AFAD (age>={AFAD_MIN_AGE}): {len(paths)} images")
    return paths, ages


def collect_utkface(root: str):
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

# Oversample UTKFace minors so the model gets enough children to learn from.
minor_p, minor_y = [], []
for p, a in zip(utk_p, utk_y):
    if a < MINOR_AGE_CUTOFF:
        for _ in range(MINOR_OVERSAMPLE - 1):  # -1 because original copy is kept below
            minor_p.append(p)
            minor_y.append(a)

paths = afad_p + utk_p + minor_p
ages = afad_y + utk_y + minor_y
print(f"Combined dataset (with {len(minor_p)} oversampled minors): {len(paths)} images")

# Age distribution sanity check
age_counts = Counter(ages)
under_18 = sum(c for a, c in age_counts.items() if a < 18)
adults = sum(c for a, c in age_counts.items() if a >= 18)
print(f"  Minors (<18): {under_18}   Adults (18+): {adults}")

train_p, val_p, train_y, val_y = train_test_split(
    paths, ages, test_size=0.05, random_state=SEED, stratify=None,
)

# ---------- Sample weights: inverse frequency ----------
train_counter = Counter(train_y)
def weight_for_age(a: int) -> float:
    c = max(train_counter[a], WEIGHT_FLOOR)
    return math.sqrt(1.0 / c)

raw_w = [weight_for_age(a) for a in train_y]
mean_w = sum(raw_w) / len(raw_w)
train_w = [w / mean_w for w in raw_w]  # normalize to mean 1
val_w = [1.0] * len(val_y)              # validation: unweighted


# ---------- tf.data pipeline ----------
def gaussian_label(age):
    age = tf.cast(age, tf.float32)
    bins = tf.range(NUM_CLASSES, dtype=tf.float32)
    g = tf.exp(-0.5 * tf.square((bins - age) / SIGMA))
    return g / tf.reduce_sum(g)


def load_image(path, age, weight):
    img = tf.io.read_file(path)
    img = tf.image.decode_jpeg(img, channels=3)
    img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
    img = tf.cast(img, tf.float32) / 255.0
    return img, gaussian_label(age), weight


def augment(img, label, weight):
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_brightness(img, 0.1)
    img = tf.image.random_contrast(img, 0.9, 1.1)
    img = tf.image.random_saturation(img, 0.9, 1.1)
    img = tf.clip_by_value(img, 0.0, 1.0)
    return img, label, weight


def make_ds(paths, ys, ws, training: bool):
    ds = tf.data.Dataset.from_tensor_slices(
        (list(paths), list(ys), list(ws))
    )
    if training:
        ds = ds.shuffle(8192, seed=SEED, reshuffle_each_iteration=True)
    ds = ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        ds = ds.map(augment, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(BATCH).prefetch(tf.data.AUTOTUNE)


train_ds = make_ds(train_p, train_y, train_w, training=True)
val_ds = make_ds(val_p, val_y, val_w, training=False)


# ---------- Metric ----------
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

# ---------- Stage 2: fine-tune ----------
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

# Evaluate on minors only as a sanity check
minor_idx = [i for i, a in enumerate(val_y) if a < MINOR_AGE_CUTOFF]
if minor_idx:
    minor_p_sub = [val_p[i] for i in minor_idx]
    minor_y_sub = [val_y[i] for i in minor_idx]
    minor_w_sub = [1.0] * len(minor_idx)
    minor_ds = make_ds(minor_p_sub, minor_y_sub, minor_w_sub, training=False)
    m_loss, m_mae = model.evaluate(minor_ds)
    print(f"Validation MAE on minors (<{MINOR_AGE_CUTOFF}): {m_mae:.2f} years "
          f"(n={len(minor_idx)})")

# ---------- Export TFLite ----------
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()
with open(OUTPUT_PATH, "wb") as f:
    f.write(tflite_model)
size_mb = len(tflite_model) / 1024 / 1024
print(f"Wrote {OUTPUT_PATH} ({size_mb:.1f} MB)")
