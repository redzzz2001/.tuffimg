# IMGTUFF v1

Site estático que cria e abre imagens no formato binário próprio `.imgtuff`.
O site processa tudo localmente no navegador.

## Uso

Abra `index.html` em um navegador. Para criar um arquivo, escolha uma imagem:
ela é sempre redimensionada para **67×67** e salva como `.imgtuff`. Para abrir
um `.imgtuff`, escolha o arquivo na área **Abrir IMGTUFF**; o site valida e
mostra seus pixels na própria página.

## Especificação binária IMGTUFF v1

Todos os inteiros são little-endian. Um arquivo v1 válido tem exatamente
18.004 bytes: header de 48 bytes e 17.956 bytes de pixels RGBA crus.

| Offset | Bytes | Campo | Valor v1 |
|---:|---:|---|---|
| 0 | 8 | magic | `IMGTUFF\0` |
| 8 | 2 | version | `1` |
| 10 | 2 | header_size | `48` |
| 12 | 2 | width | `67` |
| 14 | 2 | height | `67` |
| 16 | 1 | pixel_format | `1` = RGBA8 |
| 17 | 1 | compression | `0` = nenhuma |
| 18 | 1 | byte_order | `1` = R, G, B, A |
| 19 | 1 | flags | `0` |
| 20 | 4 | pixel_data_offset | `48` |
| 24 | 4 | pixel_data_length | `17956` |
| 28 | 4 | pixel_count | `4489` |
| 32 | 4 | file_size | `18004` |
| 36 | 4 | pixel_crc32 | CRC-32 IEEE dos pixels |
| 40 | 8 | reserved | oito bytes `00` |
| 48 | 17956 | pixel_data | pixels RGBA em ordem de linhas |

O leitor rejeita magic inválido, versões não suportadas, qualquer resolução
que não seja 67×67, campos fixos alterados, bytes extras/faltando, bytes
reservados e CRC-32 incorreto. Versões futuras usam outro número em `version`;
leitores v1 rejeitam essas versões sem tentar interpretá-las.
