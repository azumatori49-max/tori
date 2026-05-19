"""
Generate synthetic face images with age labels for commercial-clean training.

Uses Stable Diffusion 1.5 (CreativeML Open RAIL-M license — commercial OK).
Designed for Kaggle Notebooks (GPU T4 / P100). Runtime: ~2 hours for 3000 images.

Output: /kaggle/working/synthetic_faces/<age>_synth_<id>.jpg

Naming matches the loader in train_age_model_commercial.py, so after running
this you just need to:
  1. Zip the output folder
  2. Upload as a Kaggle private dataset (e.g. "ageguard-synthetic")
  3. Attach to the training notebook and point SYNTHETIC_DIR at it.

We bias generation toward underrepresented age ranges (children, late teens,
seniors) where FairFace coverage is weakest.
"""

import io
import os
import random
import time
from pathlib import Path

import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image

# ---------- Config ----------
OUTPUT_DIR = Path("/kaggle/working/synthetic_faces")
MODEL_ID = "runwayml/stable-diffusion-v1-5"   # CreativeML Open RAIL-M, commercial OK
NUM_INFERENCE_STEPS = 25
GUIDANCE_SCALE = 7.5
IMG_SIZE = 512  # SD native, resized to 224 during training
SEED_BASE = 42

# How many images to generate per age range.
# Skew heavily toward children and boundary ages (where FairFace bins are coarse).
AGE_PLAN = {
    # range : count
    (3, 7):    400,    # 子供（小学校低学年）
    (8, 12):   400,    # 子供（小学校高学年）
    (13, 17):  400,    # 中高生
    (18, 22):  400,    # 大学生・成人境界
    (23, 30):  300,
    (31, 45):  400,
    (46, 60):  400,
    (61, 75):  300,
}

ETHNICITIES = [
    "Japanese", "Korean", "Chinese", "Southeast Asian",
    "Caucasian", "African", "Latino", "Indian", "Middle Eastern",
]
GENDERS = ["man", "woman", "boy", "girl"]


def gender_for(age: int) -> str:
    """Use boy/girl for kids, man/woman for adults."""
    if age < 13:
        return random.choice(["boy", "girl"])
    return random.choice(["man", "woman"])


def build_prompt(age: int) -> str:
    ethnicity = random.choice(ETHNICITIES)
    gender = gender_for(age)
    expression = random.choice([
        "neutral expression", "slight smile", "calm expression",
    ])
    lighting = random.choice([
        "soft natural lighting", "studio lighting",
        "indoor lighting", "diffused daylight",
    ])
    return (
        f"photorealistic portrait photo of a {age}-year-old {ethnicity} {gender}, "
        f"{expression}, looking at camera, head and shoulders shot, "
        f"{lighting}, high detail, sharp focus, photograph"
    )


NEGATIVE_PROMPT = (
    "cartoon, anime, painting, illustration, drawing, 3d render, "
    "multiple faces, distorted, blurry, deformed, low quality, "
    "watermark, text, signature, frame"
)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading {MODEL_ID} ...")
    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)

    total = sum(AGE_PLAN.values())
    print(f"Generating {total} synthetic faces across {len(AGE_PLAN)} age buckets")

    counter = 0
    start = time.time()
    rng = random.Random(SEED_BASE)

    for (lo, hi), n in AGE_PLAN.items():
        for i in range(n):
            age = rng.randint(lo, hi)
            prompt = build_prompt(age)
            seed = SEED_BASE + counter
            generator = torch.Generator(device="cuda").manual_seed(seed)

            try:
                image = pipe(
                    prompt=prompt,
                    negative_prompt=NEGATIVE_PROMPT,
                    num_inference_steps=NUM_INFERENCE_STEPS,
                    guidance_scale=GUIDANCE_SCALE,
                    width=IMG_SIZE,
                    height=IMG_SIZE,
                    generator=generator,
                ).images[0]
            except Exception as e:
                print(f"[ERR] age={age} seed={seed}: {e}")
                continue

            fname = f"{age:03d}_synth_{counter:05d}.jpg"
            image.save(OUTPUT_DIR / fname, quality=92)
            counter += 1

            if counter % 50 == 0:
                elapsed = time.time() - start
                rate = counter / elapsed
                eta = (total - counter) / rate / 60
                print(f"  {counter}/{total}   {rate:.2f} img/s   ETA {eta:.0f} min")

    elapsed = time.time() - start
    print(f"\nDone. Wrote {counter} images to {OUTPUT_DIR}")
    print(f"Total time: {elapsed/60:.1f} min")


if __name__ == "__main__":
    main()
