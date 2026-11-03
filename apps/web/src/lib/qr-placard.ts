/**
 * Utility to generate a high-resolution printable/downloadable QR placard PNG
 * with scannable QR code and text labels drawn directly onto an HTML Canvas.
 */
export async function createPlacardPng({
  qrDataUrl,
  titleCode,
  subtitle,
}: {
  qrDataUrl: string;
  titleCode: string;
  subtitle?: string;
}): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(qrDataUrl);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const qrSize = 400;
      const paddingX = 40;
      const paddingTop = 36;
      const titleFontSize = 26;
      const subtitleFontSize = 16;
      const lineSpacing = 8;

      const textSectionHeight = subtitle
        ? titleFontSize + lineSpacing + subtitleFontSize + 40
        : titleFontSize + 40;

      const width = qrSize + paddingX * 2; // 480
      const height = paddingTop + qrSize + textSectionHeight + 10; // ~530

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(qrDataUrl);

      // 1. Pure white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 2. Crisp dark border frame
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      const radius = 16;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(8, 8, width - 16, height - 16, radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(8, 8, width - 16, height - 16);
      }

      // 3. Draw QR Matrix centered
      ctx.drawImage(img, paddingX, paddingTop, qrSize, qrSize);

      // 4. Draw Station / Location Code (Bold Monospace)
      const textCenterY = subtitle
        ? paddingTop + qrSize + 28
        : paddingTop + qrSize + 34;

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.fillText(titleCode, width / 2, textCenterY);

      // 5. Draw Optional Subtitle
      if (subtitle) {
        ctx.fillStyle = '#475569';
        ctx.font = `600 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
        ctx.fillText(
          subtitle,
          width / 2,
          textCenterY + titleFontSize / 2 + lineSpacing + subtitleFontSize / 2,
        );
      }

      try {
        const fullPlacardDataUrl = canvas.toDataURL('image/png');
        resolve(fullPlacardDataUrl);
      } catch (e) {
        console.error('Canvas export error:', e);
        resolve(qrDataUrl);
      }
    };

    img.onerror = () => resolve(qrDataUrl);
    img.src = qrDataUrl;
  });
}

