# 🖼️ Static Public Assets (`public/`)

This directory contains static media and files that are served directly at the root URL of the website.

---

## 📂 Contents Overview

* **`logo.png` / `logo.svg` / `MTLogoBR.png`**: Primary and secondary Munch Tokri brand logos.
* **`razorpay.svg`**: Razorpay gateway trust badge used in the footer and 1-Click checkout widget.
* **`herovideo.mp4` / `herovideo.webm`**: Background video assets for the homepage hero banner.
* **`mixture_banner.png`**: Promotional banner image for the Build your Mixture tool.
* **`images/`**: Product fallback thumbnails and category illustration assets.

---

## ⚠️ Important Rules for `public/`

✅ **What belongs here**:
- Publicly accessible images, SVGs, favicon icons, and optimized video clips.
- Files referenced directly in code via `/filename.ext` (e.g. `<img src="/logo.png" />`).

❌ **What must NEVER be placed here**:
- **Never put code files (.ts, .tsx, .js) here.**
- **Never store customer private data, invoice PDFs, or user uploads here.** (User uploads must go to Cloud Storage).
