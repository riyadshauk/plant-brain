import type { CoursePlant } from './course';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function fitSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

async function jpegData(url: string): Promise<string> {
  const image = new Image();
  image.src = `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;
  await image.decode();
  const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare an image for the PDF.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export async function createScavengerPdf(items: CoursePlant[], title: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const ink = rgb(0.09, 0.22, 0.16);
  const muted = rgb(0.33, 0.42, 0.35);
  const border = rgb(0.82, 0.87, 0.82);
  const paper = rgb(0.95, 0.97, 0.94);
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>> | null>();

  const textSize = (value: string, font: typeof regular, maxWidth: number, desired: number) => {
    let size = desired;
    while (size > 7 && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.5;
    return size;
  };
  const drawPhoto = async (page: ReturnType<typeof pdf.addPage>, url: string, x: number, y: number, width: number, height: number) => {
    page.drawRectangle({ x, y, width, height, color: paper });
    let image = imageCache.get(url);
    if (image === undefined) {
      try { image = await pdf.embedJpg(await jpegData(url)); }
      catch { image = null; }
      imageCache.set(url, image);
    }
    if (image) {
      const size = fitSize(image.width, image.height, width - 4, height - 4);
      page.drawImage(image, { x: x + (width - size.width) / 2, y: y + (height - size.height) / 2, ...size });
    } else {
      page.drawText('Photo unavailable', { x: x + 8, y: y + height / 2, size: 8, font: regular, color: muted });
    }
  };

  for (let start = 0; start < items.length; start += 4) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const pageNumber = start / 4 + 1;
    page.drawText('PLANT WALK', { x: 24, y: 760, size: 9, font: bold, color: muted });
    page.drawText(title, { x: 24, y: 740, size: textSize(title, bold, 500, 16), font: bold, color: ink });
    page.drawText(`${pageNumber} / ${Math.ceil(items.length / 4)}`, { x: 545, y: 17, size: 9, font: regular, color: muted });
    for (let local = 0; local < 4 && start + local < items.length; local++) {
      const item = items[start + local];
      const col = local % 2;
      const row = Math.floor(local / 2);
      const x = 24 + col * 282;
      const y = 36 + (1 - row) * 346;
      const width = 270;
      const height = 334;
      page.drawRectangle({ x, y, width, height, borderColor: border, borderWidth: 1, color: rgb(1, 1, 1) });
      page.drawText(item.membership.facts.commonName, { x: x + 10, y: y + height - 20, size: textSize(item.membership.facts.commonName, bold, width - 20, 11), font: bold, color: ink });
      page.drawText(item.membership.facts.scientificName, { x: x + 10, y: y + height - 35, size: textSize(item.membership.facts.scientificName, italic, width - 20, 9.5), font: italic, color: muted });
      const photos = item.images.slice(0, 3);
      if (photos.length === 0) {
        page.drawText('No instructor photos available', { x: x + 30, y: y + 145, size: 9, font: regular, color: muted });
      } else if (photos.length === 1) {
        await drawPhoto(page, photos[0].url, x + 10, y + 10, width - 20, height - 57);
      } else if (photos.length === 2) {
        await drawPhoto(page, photos[0].url, x + 10, y + 10, 122, height - 57);
        await drawPhoto(page, photos[1].url, x + 138, y + 10, 122, height - 57);
      } else {
        await drawPhoto(page, photos[0].url, x + 10, y + 143, width - 20, 134);
        await drawPhoto(page, photos[1].url, x + 10, y + 10, 122, 127);
        await drawPhoto(page, photos[2].url, x + 138, y + 10, 122, 127);
      }
    }
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
