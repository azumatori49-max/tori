"""
Train an age estimation model on UTKFace and export to TFLite for AgeGuard Kiosk.

Designed for Google Colab (free T4 GPU). Runs end-to-end in ~30 min.

Output: age_model.tflite
  - input  : float32 [1, 224, 224, 3], RGB, normalized 0..1
  - output : float32 [1, 1], predicted age in years (regression)

These I/O specs match AgeEstimator.kt so you can drop the file straight into
AgeGuardKiosk/app/src/main/assets/age_model.tflite without code changes.
"""

import glob
import os
import re

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras import applications, layers, models

# ---------- Config ----------
DATA_DIR = "/content/UTKFace"   # directory containing UTKFace *.jpg files
IMG_SIZE = 224
BATCH = 64
EPOCHS_HEAD = 8                  # warm up the new head with frozen backbone
EPOCHS_FT = 6                    # fine-tune top of backbone
OUTPUT_PATH = "/content/age_model.tflite"
SEED = 42

# ---------- Load & split ----------
def parse_age(path: str):
    """UTKFace filename: [age]_[gender]_[race]_[date&time].jpg"""
    m = re.match(r"(\d+)_", os.path.basename(path))
    return int(m.group(1)) if m else None

paths = sorted(glob.glob(os.path.join(DATA_DIR, "*.jpg")))
labels = [parse_age(p) for p in paths]
pairs = [(p, l) for p, l in zip(paths, labels) if l is not None and 0 < l < 100]
paths, labels = zip(*pairs)
paths, labels = list(paths), list(labels)
print(f"Total usable images: {len(paths)}")

train_p, val_p, train_y, val_y = train_test_split(
    paths, labels, test_size=0.1, random_state=SEED
)

# ---------- tf.data pipeline ----------
def load_image(path, age):
    img = tf.io.read_file(path)
    img = tf.image.decode_jpeg(img, channels=3)
    img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
    img = tf.cast(img, tf.float32) / 255.0
    return img, tf.cast(age, tf.float32)

def augment(img, age):
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_brightness(img, 0.1)
    img = tf.image.random_contrast(img, 0.9, 1.1)
    img = tf.clip_by_value(img, 0.0, 1.0)
    return img, age

def make_ds(paths, ys, training=False):
    ds = tf.data.Dataset.from_tensor_slices((list(paths), list(ys)))
    if training:
        ds = ds.shuffle(2048, seed=SEED)
    ds = ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        ds = ds.map(augment, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(BATCH).prefetch(tf.data.AUTOTUNE)

train_ds = make_ds(train_p, train_y, training=True)
val_ds = make_ds(val_p, val_y)

# ---------- Model ----------
base = applications.MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet",
)
base.trainable = False

model = models.Sequential([
    base,
    layers.GlobalAveragePooling2D(),
    layers.Dropout(0.3),
    layers.Dense(128, activation="relu"),
    layers.Dropout(0.2),
    layers.Dense(1),  # age regression
])
model.summary()

# ---------- Stage 1: head-only ----------
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss=tf.keras.losses.Huber(delta=5.0),
    metrics=["mae"],
)
model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD)

# ---------- Stage 2: fine-tune top of backbone ----------
base.trainable = True
for layer in base.layers[:-40]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-5),
    loss=tf.keras.losses.Huber(delta=5.0),
    metrics=["mae"],
)
model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FT)

# ---------- Evaluate ----------
val_loss, val_mae = model.evaluate(val_ds)
print(f"Validation MAE: {val_mae:.2f} years")

# ---------- Export TFLite ----------
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()
with open(OUTPUT_PATH, "wb") as f:
    f.write(tflite_model)
print(f"Wrote {OUTPUT_PATH} ({len(tflite_model) / 1024 / 1024:.1f} MB)")
