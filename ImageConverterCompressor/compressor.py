"""Convert image files to compressed WebP format."""

import os

try:
    from PIL import Image  # type: ignore[import-not-found]
except ImportError as exc:
    raise RuntimeError(
        "Pillow is required. Install it with: pip install pillow"
    ) from exc


def convert_to_webp(source_path, target_quality=80):
    """
    Converts a single image to .webp format with compression.
    """
    if not os.path.exists(source_path):
        print(f"Error: File not found at {source_path}")
        return

    # Separate the file extension from the base path
    base_path, _ = os.path.splitext(source_path)
    output_path = f"{base_path}.webp"

    try:
        with Image.open(source_path) as img:
            # Convert RGBA (PNG with transparency) to RGB if saving to a format that requires it.
            # WebP supports transparency, but if the source is CMYK, it needs conversion.
            if img.mode in ("CMYK", "P"):
                img = img.convert("RGB")

            # Save as WebP with the specified quality reduction
            img.save(output_path, "WEBP", quality=target_quality)

            # Calculate file size savings
            original_size = os.path.getsize(source_path) / 1024
            new_size = os.path.getsize(output_path) / 1024
            savings = ((original_size - new_size) / original_size) * 100

            print(f"✓ Converted: {os.path.basename(source_path)}")
            print(
                f"  Size: {original_size:.1f}KB → {new_size:.1f}KB ({savings:.1f}% smaller)\n"
            )

    except (OSError, ValueError) as e:
        print(f"✗ Failed to convert {os.path.basename(source_path)}: {e}")


def bulk_convert_folder(folder_path, target_quality=80):
    """
    Finds all JPG, JPEG, and PNG images in a folder and converts them to .webp.
    """
    valid_extensions = (".jpg", ".jpeg", ".png")

    if not os.path.isdir(folder_path):
        print(f"Error: Folder not found at {folder_path}")
        return

    print(f"Starting bulk conversion in: {folder_path}\n" + "=" * 40)

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(valid_extensions):
            full_path = os.path.join(folder_path, filename)
            convert_to_webp(full_path, target_quality)

    print("=" * 40 + "\nBulk conversion complete!")


# --- HOW TO USE IT ---
if __name__ == "__main__":
    # Example 1: Convert a single image
    # convert_to_webp("coffee_shop_hero.jpg", target_quality=80)

    # Example 2: Bulk convert a folder (e.g., your template's images folder)
    # Replace "images" with the actual path to your folder
    IMAGES_FOLDER = "./images"

    # Create a dummy folder and run if you want to test it
    if os.path.exists(IMAGES_FOLDER):
        bulk_convert_folder(IMAGES_FOLDER, target_quality=80)
    else:
        print(
            "Please update the 'IMAGES_FOLDER' path or create a folder named "
            f"'{IMAGES_FOLDER}' to test bulk conversion."
        )
