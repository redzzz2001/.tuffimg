# IMGTUFF v1

`IMGTUFF` é um formato de imagem binário próprio, com extensão `.imgtuff`.
Ele não encapsula PNG, JPEG, WebP ou qualquer outro formato: o payload contém
somente bytes RGBA crus em uma estrutura definida aqui.

## Site estático para GitHub Pages

Este é um projeto web normal, sem plataforma externa. Para testar localmente:

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080`. Para publicar, envie estes arquivos a um
repositório GitHub e ative **Settings → Pages → Deploy from a branch**,
selecionando a branch `main` e a pasta `/ (root)`.

O site funciona totalmente no navegador: nenhum arquivo é enviado a servidor.
No encoder, a imagem precisa ser 67x67; a opção de redimensionar é explícita.

## Especificação completa: IMGTUFF v1

Todos os números inteiros de mais de um byte usam **little-endian**. O arquivo
v1 usa exatamente 18.004 bytes: header de 48 bytes e 17.956 bytes de pixels.

| Offset | Tamanho | Campo | Valor/regra v1 |
|---:|---:|---|---|
| 0 | 8 | `magic` | ASCII `IMGTUFF` seguido de `00` (`49 4D 47 54 55 46 46 00`) |
| 8 | 2 | `version` | `1` (`uint16`) |
| 10 | 2 | `header_size` | `48` (`uint16`) |
| 12 | 2 | `width` | `67` (`uint16`) |
| 14 | 2 | `height` | `67` (`uint16`) |
| 16 | 1 | `pixel_format` | `1` = `RGBA8` |
| 17 | 1 | `compression` | `0` = sem compressão |
| 18 | 1 | `byte_order` | `1` = ordem de canais R, G, B, A |
| 19 | 1 | `flags` | `0`; bits reservados para versões futuras |
| 20 | 4 | `pixel_data_offset` | `48` (`uint32`) |
| 24 | 4 | `pixel_data_length` | `17956` (`uint32`) |
| 28 | 4 | `pixel_count` | `4489` (`uint32`) |
| 32 | 4 | `file_size` | `18004` (`uint32`) |
| 36 | 4 | `pixel_crc32` | CRC-32 IEEE do payload de pixels (`uint32`) |
| 40 | 8 | `reserved` | oito bytes `00` |
| 48 | 17956 | `pixel_data` | 67 linhas, cada uma com 67 pixels RGBA8 |

### Pixels

Cada pixel ocupa quatro bytes, nesta ordem: `R`, `G`, `B`, `A`. Cada canal é
um inteiro sem sinal de 8 bits (`0..255`). Os pixels são armazenados em ordem
de linhas: `(0,0)`, `(1,0)` ... `(66,0)`, `(0,1)` ... `(66,66)`.

### Regras de validação

Um arquivo v1 é válido apenas se todos estes testes passarem:

1. tem o magic exato e pelo menos 48 bytes;
2. `version == 1` e todos os campos fixos possuem os valores da tabela;
3. largura e altura são exatamente 67;
4. `pixel_data_length == width * height * 4`, `pixel_count == width * height`;
5. `pixel_data_offset + pixel_data_length == file_size ==` tamanho real;
6. os oito bytes reservados são zero;
7. o CRC-32 do payload bate com `pixel_crc32`.

Qualquer byte extra, truncamento, cabeçalho alterado, campo reservado usado ou
payload corrompido é rejeitado. Uma versão diferente de 1 é reconhecida pelo
magic, mas é rejeitada como **não suportada**, jamais decodificada como v1.

### Encoder e decoder

O encoder converte a imagem de entrada para RGBA, exige ou cria (com
`--resize`) 67x67, grava os pixels em ordem de linhas, calcula o CRC-32 e só
então monta o header v1. O decoder primeiro executa toda a validação acima; só
depois entrega os bytes RGBA ao codificador PNG de saída. Assim, PNG só existe
na entrada/saída da ferramenta — nunca dentro de `.imgtuff`.

### Evolução

O magic identifica a família; `version` escolhe o interpretador e
`header_size`/`pixel_data_offset` permitem que versões futuras ampliem o
cabeçalho. Implementações v1 não tentam adivinhar formatos novos: rejeitam
versões desconhecidas de forma segura, preservando a capacidade de abrir os
arquivos v1 antigos.

## Testes

```bash
python3 -m unittest -v
```
