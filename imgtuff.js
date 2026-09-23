(() => {
  'use strict';
  const MAGIC = [0x49, 0x4d, 0x47, 0x54, 0x55, 0x46, 0x46, 0x00];
  const WIDTH = 67, HEIGHT = 67, HEADER_SIZE = 48, PIXEL_LENGTH = WIDTH * HEIGHT * 4, FILE_SIZE = HEADER_SIZE + PIXEL_LENGTH;
  let loadedImage = null, decoded = null;
  const $ = (id) => document.getElementById(id);

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function setStatus(id, message, type = 'muted') {
    const element = $(id); element.textContent = message; element.className = `status ${type}`;
  }
  function download(blob, name) {
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function baseName(name) { return name.replace(/\.[^.]+$/, '') || 'imagem'; }

  function pixelsFromImage(image, resize) {
    if ((image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) && !resize) {
      throw new Error(`A imagem é ${image.naturalWidth}×${image.naturalHeight}; IMGTUFF exige 67×67.`);
    }
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    return new Uint8Array(context.getImageData(0, 0, WIDTH, HEIGHT).data);
  }
  function makeFile(pixels) {
    const data = new Uint8Array(FILE_SIZE), view = new DataView(data.buffer);
    data.set(MAGIC, 0);
    view.setUint16(8, 1, true); view.setUint16(10, HEADER_SIZE, true);
    view.setUint16(12, WIDTH, true); view.setUint16(14, HEIGHT, true);
    data[16] = 1; data[17] = 0; data[18] = 1; data[19] = 0;
    view.setUint32(20, HEADER_SIZE, true); view.setUint32(24, PIXEL_LENGTH, true);
    view.setUint32(28, WIDTH * HEIGHT, true); view.setUint32(32, FILE_SIZE, true);
    view.setUint32(36, crc32(pixels), true); data.set(pixels, HEADER_SIZE);
    return data;
  }
  function validate(buffer) {
    const data = new Uint8Array(buffer), view = new DataView(buffer);
    if (data.length < HEADER_SIZE) throw new Error('Arquivo truncado: o header precisa de 48 bytes.');
    if (!MAGIC.every((value, index) => data[index] === value)) throw new Error('Magic inválido: isto não é um IMGTUFF.');
    if (view.getUint16(8, true) !== 1) throw new Error(`Versão ${view.getUint16(8, true)} não suportada.`);
    const fields = [
      [10, 2, HEADER_SIZE, 'header_size'], [12, 2, WIDTH, 'largura'], [14, 2, HEIGHT, 'altura'],
      [16, 1, 1, 'formato de pixel'], [17, 1, 0, 'compressão'], [18, 1, 1, 'ordem de canais'],
      [19, 1, 0, 'flags'], [20, 4, HEADER_SIZE, 'offset'], [24, 4, PIXEL_LENGTH, 'tamanho dos pixels'],
      [28, 4, WIDTH * HEIGHT, 'quantidade de pixels'], [32, 4, FILE_SIZE, 'tamanho declarado']
    ];
    for (const [offset, size, expected, label] of fields) {
      const value = size === 1 ? data[offset] : size === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true);
      if (value !== expected) throw new Error(`${label} inválido: ${value}; esperado ${expected}.`);
    }
    if (data.length !== FILE_SIZE) throw new Error(`Tamanho real inválido: ${data.length}; esperado ${FILE_SIZE}.`);
    if (data.slice(40, 48).some(Boolean)) throw new Error('Bytes reservados devem ser zero.');
    const pixels = data.slice(HEADER_SIZE), stored = view.getUint32(36, true), actual = crc32(pixels);
    if (stored !== actual) throw new Error(`CRC-32 inválido: ${actual.toString(16).padStart(8, '0').toUpperCase()}; esperado ${stored.toString(16).padStart(8, '0').toUpperCase()}.`);
    return { pixels, crc: stored };
  }
  function formatMetadata(crc) {
    return `IMGTUFF v1 — válido\nmagic       IMGTUFF\\0\ndimensões   67 × 67 px\npixels      RGBA8 (R-G-B-A)\ncompressão  nenhuma\nheader      48 bytes\npayload     17.956 bytes\nCRC-32      ${crc.toString(16).padStart(8, '0').toUpperCase()}\narquivo     18.004 bytes`;
  }

  $('encode-file').addEventListener('change', (event) => {
    const file = event.target.files[0]; loadedImage = null; $('encode-button').disabled = true;
    if (!file) return setStatus('source-status', 'Nenhuma imagem selecionada.');
    const image = new Image();
    image.onload = () => {
      loadedImage = { image, name: file.name }; $('encode-button').disabled = false;
      const type = image.naturalWidth === WIDTH && image.naturalHeight === HEIGHT ? 'ok' : 'muted';
      setStatus('source-status', `${file.name} · ${image.naturalWidth}×${image.naturalHeight}px`, type);
    };
    image.onerror = () => setStatus('source-status', 'Não consegui ler esta imagem.', 'error');
    image.src = URL.createObjectURL(file);
  });
  $('encode-button').addEventListener('click', () => {
    try {
      const pixels = pixelsFromImage(loadedImage.image, $('resize').checked);
      const name = `${baseName(loadedImage.name)}.imgtuff`;
      download(new Blob([makeFile(pixels)], { type: 'application/octet-stream' }), name);
      setStatus('source-status', `Pronto: ${name} criado com 18.004 bytes.`, 'ok');
    } catch (error) { setStatus('source-status', error.message, 'error'); }
  });
  $('decode-file').addEventListener('change', async (event) => {
    const file = event.target.files[0]; decoded = null; $('decode-button').disabled = true; $('metadata').hidden = true;
    if (!file) return setStatus('validation-status', 'Aguardando arquivo.');
    try {
      const result = validate(await file.arrayBuffer()); decoded = { ...result, name: file.name };
      setStatus('validation-status', 'Arquivo válido. GG.', 'ok');
      $('metadata').textContent = formatMetadata(result.crc); $('metadata').hidden = false; $('decode-button').disabled = false;
    } catch (error) { setStatus('validation-status', `Rejeitado: ${error.message}`, 'error'); }
  });
  $('decode-button').addEventListener('click', () => {
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels), WIDTH, HEIGHT), 0, 0);
    canvas.toBlob((blob) => download(blob, `${baseName(decoded.name)}.png`), 'image/png');
  });
})();
