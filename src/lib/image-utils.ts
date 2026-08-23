const BLOB_TIMEOUT_MS = 15_000; // 15 seconds max for toBlob

export async function compressImage(
    file: File,
    maxWidth = 1200,
    quality = 0.7
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((maxWidth / width) * height);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas 2D context not available'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                // Guard against toBlob never firing (some browsers/environments)
                const timeout = setTimeout(() => {
                    reject(new Error('Image compression timed out'));
                }, BLOB_TIMEOUT_MS);

                canvas.toBlob(
                    (blob) => {
                        clearTimeout(timeout);
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas toBlob returned null'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.src = event.target?.result as string;
        };

        reader.readAsDataURL(file);
    });
}
