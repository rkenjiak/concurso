/**
 * Gera os ícones do app (`pnpm icones`, #66) a partir de `assets/logo.svg`:
 *
 * - `src/app/icon.svg` (favicon) e `assets/icon.svg` (README): SVG com cantos arredondados;
 * - `src/app/apple-icon.png` (180×180): o iOS arredonda sozinho, então fundo quadrado;
 * - `public/icons/icon-192.png`, `icon-512.png` ("any") e `icon-maskable-512.png` (manifest).
 *
 * Os arquivos gerados são versionados; rode de novo só ao alterar o logo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { extrairPartes, svgVariante, VARIANTES } from "./icones";

const partes = extrairPartes(readFileSync("assets/logo.svg", "utf8"));
const cheio = svgVariante(partes, VARIANTES.cheio);
const arredondado = svgVariante(partes, VARIANTES.arredondado);
const maskable = svgVariante(partes, VARIANTES.maskable);

async function png(svg: string, tamanho: number, destino: string) {
  await sharp(Buffer.from(svg), { density: 72 * (tamanho / 512) * 4 })
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toFile(destino);
  console.log(`✓ ${destino}`);
}

writeFileSync("src/app/icon.svg", arredondado);
writeFileSync("assets/icon.svg", arredondado);
console.log("✓ src/app/icon.svg\n✓ assets/icon.svg");

await mkdir("public/icons", { recursive: true });
await png(cheio, 180, "src/app/apple-icon.png");
await png(cheio, 192, "public/icons/icon-192.png");
await png(cheio, 512, "public/icons/icon-512.png");
await png(maskable, 512, "public/icons/icon-maskable-512.png");
