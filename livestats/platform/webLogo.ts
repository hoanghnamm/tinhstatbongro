import { WEB_LOGO_MAX_LENGTH } from '../lib/team';

/** Flatten picker images into a bounded PNG; blob URLs do not survive reload. */
export async function webLogo(source: string): Promise<string> {
  if (!/^(?:data:image\/|blob:)/.test(source)) throw new Error('Choose a local image');
  const img = document.createElement('img');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { img.src = ''; reject(new Error('Image load timed out')); }, 15000);
    img.onload = () => { clearTimeout(timer); resolve(); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Image could not load')); };
    img.src = source;
  });
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image is empty');
  const scale = Math.min(1, 384 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Images are unavailable in this browser');
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const uri = canvas.toDataURL('image/png');
  if (uri.length > WEB_LOGO_MAX_LENGTH) throw new Error('Choose a smaller logo');
  return uri;
}
