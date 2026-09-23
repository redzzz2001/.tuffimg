(() => {
  const MAGIC = [0x49, 0x4d, 0x47, 0x54, 0x55, 0x46, 0x46, 0];
  const W = 67, H = 67, HEADER = 48, PIXELS = W * H * 4, SIZE = HEADER + PIXELS;
  const $ = (id) => document.getElementById(id);
  let sourceImage = null;

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const value of bytes) {
      crc ^= value;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function status(id, text, kind = '') { const item = $(id); item.textContent = text; item.className = kind; }
  function nameWithoutExtension(name) { return name.replace(/\.[^.]+$/, '') || 'imagem'; }
  function pixelsFrom(image) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, W, H);
    return new Uint8Array(context.getImageData(0, 0, W, H).data);
  }
  function create(pixels) {
    const output = new Uint8Array(SIZE), view = new DataView(output.buffer);
    output.set(MAGIC);
    view.setUint16(8, 1, true); view.setUint16(10, HEADER, true);
    view.setUint16(12, W, true); view.setUint16(14, H, true);
    output[16] = 1; output[17] = 0; output[18] = 1; output[19] = 0;
    view.setUint32(20, HEADER, true); view.setUint32(24, PIXELS, true);
    view.setUint32(28, W * H, true); view.setUint32(32, SIZE, true);
    view.setUint32(36, crc32(pixels), true); output.set(pixels, HEADER);
    return output;
  }
  function validate(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    if (bytes.length < HEADER) throw new Error('Arquivo truncado: header menor que 48 bytes.');
    if (!MAGIC.every((value, index) => bytes[index] === value)) throw new Error('Magic inválido: não é IMGTUFF.');
    if (view.getUint16(8, true) !== 1) throw new Error(`Versão ${view.getUint16(8, true)} não suportada.`);
    const fields = [[10,2,HEADER,'header_size'],[12,2,W,'largura'],[14,2,H,'altura'],[16,1,1,'pixel_format'],[17,1,0,'compression'],[18,1,1,'byte_order'],[19,1,0,'flags'],[20,4,HEADER,'pixel_data_offset'],[24,4,PIXELS,'pixel_data_length'],[28,4,W*H,'pixel_count'],[32,4,SIZE,'file_size']];
    for (const [offset, length, required, label] of fields) {
      const actual = length === 1 ? bytes[offset] : length === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true);
      if (actual !== required) throw new Error(`${label} inválido.`);
    }
    if (bytes.length !== SIZE) throw new Error(`Tamanho inválido: ${bytes.length}; esperado ${SIZE}.`);
    if (bytes.slice(40, 48).some(Boolean)) throw new Error('Bytes reservados inválidos.');
    const pixels = bytes.slice(HEADER), expectedCrc = view.getUint32(36, true);
    if (crc32(pixels) !== expectedCrc) throw new Error('CRC-32 inválido: pixels corrompidos.');
    return { pixels, expectedCrc };
  }
  function download(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('source').addEventListener('change', (event) => {
    const file = event.target.files[0]; sourceImage = null; $('encode').disabled = true;
    if (!file) return;
    const image = new Image();
    image.onload = () => { sourceImage = { image, name: file.name }; $('encode').disabled = false; status('encode-status', `${file.name} será gravada em 67×67.`, 'ok'); };
    image.onerror = () => status('encode-status', 'Não consegui abrir essa imagem.', 'error');
    image.src = URL.createObjectURL(file);
  });
  $('encode').addEventListener('click', () => {
    const file = create(pixelsFrom(sourceImage.image));
    download(file, `${nameWithoutExtension(sourceImage.name)}.imgtuff`);
    status('encode-status', 'IMGTUFF v1 criado: 18.004 bytes.', 'ok');
  });
  $('encoded').addEventListener('change', async (event) => {
    const file = event.target.files[0]; $('preview').hidden = true; $('info').hidden = true;
    if (!file) return;
    try {
      const decoded = validate(await file.arrayBuffer());
      const canvas = $('preview');
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels), W, H), 0, 0);
      canvas.hidden = false;
      $('info').textContent = `IMGTUFF v1 válido\n67 × 67 pixels · RGBA8 · sem compressão\nHeader: 48 bytes · Arquivo: 18.004 bytes\nCRC-32: ${decoded.expectedCrc.toString(16).padStart(8, '0').toUpperCase()}`;
      $('info').hidden = false;
      status('decode-status', `Aberto: ${file.name}`, 'ok');
    } catch (error) { status('decode-status', `Rejeitado: ${error.message}`, 'error'); }
  });
})();
