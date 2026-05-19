"""
Commercial-clean age model: FairFace + employee photos + optional synthetic.

Designed for Kaggle Notebooks. Runtime: ~2 hours on GPU T4.

Strategy:
- FairFace (CC-BY 4.0, commercial OK): 108k images, 9 age bins.
  Use bin midpoints as soft labels — gives full age-range coverage.
- Employee photos (in-house, consented): exact-age labels.
  Heavy sample weight because they're few but premium quality.
- (Optional) synthetic faces from Stable Diffusion: any age, no rights issues.

Output: /kaggle/working/age_model.tflite
  - input  : float32 [1, 224, 224, 3], RGB, normalized 0..1
  - output : float32 [1, 101] softmax over ages 0..100

Drops straight into AgeGuardKiosk/app/src/main/assets/age_model.tflite
with no app code changes.

Required Kaggle inputs (attach via "+ Add Data"):
- FairFace dataset (search "fairface")
- Your private dataset of employee photos
- (Optional) synthetic faces dataset
"""

import csv
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
# These paths are likely to differ in your environment.
# After attaching the datasets, run a `!find /kaggle/input -maxdepth 4 -type d` cell to confirm.
FAIRFACE_DIR = "/kaggle/input/fairface"          # contains *.csv label files + folders of jpgs
EMPLOYEE_DIR = "/kaggle/input/employees"          # 800 employee photos
SYNTHETIC_DIR = "/kaggle/input/synthetic-faces"   # optional, skip if not present

IMG_SIZE = 224
NUM_CLASSES = 101
BATCH = 96
EPOCHS_HEAD = 5
EPOCHS_FT = 12
SIGMA = 2.0
SEED = 42
OUTPUT_PATH = "/kaggle/working/age_model.tflite"

# Sample weights:
EMPLOYEE_WEIGHT = 5.0   # employees count 5x in loss
FAIRFACE_WEIGHT = 1.0
SYNTHETIC_WEIGHT = 0.5  # synthetic data is noisier
WEIGHT_FLOOR = 50       # inverse-frequency cap

# FairFace bin → midpoint (continuous age proxy)
FAIRFACE_BIN_TO_AGE = {
    "0-2":   1,
    "3-9":   6,
    "10-19": 14,
    "20-29": 24,
    "30-39": 34,
    "40-49": 44,
    "50-59": 54,
    "60-69": 64,
    "more than 70": 75,
}


# ---------- Dataset loaders ----------
def collect_fairface(root: str):
    """FairFace ships *.csv label files + image folders.
    Typical layout: <root>/fairface_label_train.csv, <root>/train/<id>.jpg
    """
    if not os.path.isdir(root):
        print(f"[WARN] FairFace not found at {root}, skipping.")
        return [], []
    paths, ages = [], []
    csvs = glob.glob(os.path.join(root, "**", "*.csv"), recursive=True)
    for csv_path in csvs:
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                rel = row.get("file") or row.get("filename") or row.get("path")
                age_bin = row.get("age") or row.get("age_group")
                if not rel or not age_bin:
                    continue
                age_bin = age_bin.strip()
                if age_bin not in FAIRFACE_BIN_TO_AGE:
                    continue
                # The CSV path is usually like "train/123.jpg"
                full = os.path.join(root, rel)
                if not os.path.isfile(full):
                    # Fall back to searching
                    matches = glob.glob(os.path.join(root, "**", os.path.basename(rel)), recursive=True)
                    if matches:
                        full = matches[0]
                    else:
                        continue
                paths.append(full)
                ages.append(FAIRFACE_BIN_TO_AGE[age_bin])
    print(f"FairFace: {len(paths)} images")
    return paths, ages


def collect_employees(root: str):
    """Employee photos. Supports two layouts:

    1. labels.csv at root with columns (filename, age) — preferred.
    2. Filename convention <age>_<id>.jpg or <id>_age<NN>.jpg.
    """
    if not os.path.isdir(root):
        print(f"[WARN] Employee dir not found at {root}, skipping.")
        return [], []

    paths, ages = [], []
    csv_path = os.path.join(root, "labels.csv")
    if os.path.isfile(csv_path):
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                fname = row.get("filename") or row.get("file")
                age_str = row.get("age")
                if not fname or not age_str:
                    continue
                try:
                    age = int(age_str)
                except ValueError:
                    continue
                if not (0 < age < 100):
                    continue
                full = os.path.join(root, fname)
                if not os.path.isfile(full):
                    matches = glob.glob(os.path.join(root, "**", fname), recursive=True)
                    if matches:
                        full = matches[0]
                    else:
                        continue
                paths.append(full)
                ages.append(age)
        print(f"Employees (via labels.csv): {len(paths)} images")
        return paths, ages

    # Filename fallback
    for p in glob.glob(os.path.join(root, "**", "*.jpg"), recursive=True) + \
             glob.glob(os.path.join(root, "**", "*.jpeg"), recursive=True) + \
             glob.glob(os.path.join(root, "**", "*.png"), recursive=True):
        name = os.path.basename(p)
        # Match <age>_<anything>.jpg
        m = re.match(r"(\d+)_", name)
        age = None
        if m:
            age = int(m.group(1))
        else:
            # Match <anything>_age(\d+).jpg
            m = re.search(r"age[_-]?(\d+)", name, re.IGNORECASE)
            if m:
                age = int(m.group(1))
        if age is not None and 0 < age < 100:
            paths.append(p)
            ages.append(age)
    print(f"Employees (via filename): {len(paths)} images")
    return paths, ages


def collect_synthetic(root: str):
    """Synthetic faces. Filename: <age>_synth_<id>.jpg"""
    if not os.path.isdir(root):
        print(f"[INFO] Synthetic dir not found at {root}, skipping (optional).")
        return [], []
    paths, ages = [], []
    for p in glob.glob(os.path.join(root, "**", "*.jpg"), recursive=True):
        m = re.match(r"(\d+)_", os.path.basename(p))
        if not m:
            continue
        age = int(m.group(1))
        if 0 < age < 100:
            paths.append(p)
            ages.append(age)
    print(f"Synthetic: {len(paths)} images")
    return paths, ages


ff_p, ff_y = collect_fairface(FAIRFACE_DIR)
emp_p, emp_y = collect_employees(EMPLOYEE_DIR)
syn_p, syn_y = collect_synthetic(SYNTHETIC_DIR)

# Per-source sample weight assignment
paths = ff_p + emp_p + syn_p
ages = ff_y + emp_y + syn_y
sources = (
    ["fairface"] * len(ff_p)
    + ["employee"] * len(emp_p)
    + ["synthetic"] * len(syn_p)
)
assert len(paths) > 1000, f"Only {len(paths)} images found — check dataset paths."
print(f"Combined dataset: {len(paths)} images")

# Age distribution
age_counts = Counter(ages)
under_18 = sum(c for a, c in age_counts.items() if a < 18)
adults = sum(c for a, c in age_counts.items() if a >= 18)
print(f"  Minors (<18): {under_18}   Adults (18+): {adults}")

train_p, val_p, train_y, val_y, train_src, val_src = train_test_split(
    paths, ages, sources, test_size=0.05, random_state=SEED,
)


# ---------- Sample weight ----------
train_age_counts = Counter(train_y)
SOURCE_WEIGHTS = {
    "fairface": FAIRFACE_WEIGHT,
    "employee": EMPLOYEE_WEIGHT,
    "synthetic": SYNTHETIC_WEIGHT,
}


def compute_weight(age: int, src: str) -> float:
    base = SOURCE_WEIGHTS[src]
    freq_factor = math.sqrt(1.0 / max(train_age_counts[age], WEIGHT_FLOOR))
    return base * freq_factor


raw_train_w = [compute_weight(a, s) for a, s in zip(train_y, train_src)]
mean_w = sum(raw_train_w) / len(raw_train_w)
train_w = [w / mean_w for w in raw_train_w]
val_w = [1.0] * len(val_y)


# ---------- tf.data pipeline ----------
def gaussian_label(age):
    age = tf.cast(age, tf.float32)
    bins = tf.range(NUM_CLASSES, dtype=tf.float32)
    g = tf.exp(-0.5 * tf.square((bins - age) / SIGMA))
    return g / tf.reduce_sum(g)


def load_image(path, age, weight):
    img = tf.io.read_file(path)
    img = tf.io.decode_image(img, channels=3, expand_animations=False)
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
    ds = tf.data.Dataset.from_tensor_slices((list(paths), list(ys), list(ws)))
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


# ---------- Evaluation ----------
val_loss, val_mae = model.evaluate(val_ds)
print(f"\nFinal validation expected-age MAE: {val_mae:.2f} years")

# Per-cohort sanity check
def evaluate_cohort(name, condition):
    idx = [i for i, a in enumerate(val_y) if condition(a)]
    if not idx:
        return
    sub_p = [val_p[i] for i in idx]
    sub_y = [val_y[i] for i in idx]
    sub_w = [1.0] * len(idx)
    sub_ds = make_ds(sub_p, sub_y, sub_w, training=False)
    _, sub_mae = model.evaluate(sub_ds, verbose=0)
    print(f"  MAE on {name}: {sub_mae:.2f} years (n={len(idx)})")


evaluate_cohort("minors (<18)", lambda a: a < 18)
evaluate_cohort("18-22 (boundary)", lambda a: 18 <= a < 23)
evaluate_cohort("adults 23-50", lambda a: 23 <= a < 50)
evaluate_cohort("seniors 50+", lambda a: a >= 50)


# ---------- Export TFLite ----------
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()
with open(OUTPUT_PATH, "wb") as f:
    f.write(tflite_model)
size_mb = len(tflite_model) / 1024 / 1024
print(f"Wrote {OUTPUT_PATH} ({size_mb:.1f} MB)")
