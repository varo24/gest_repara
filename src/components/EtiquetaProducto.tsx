import React, { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { InventoryItem, AppSettings } from '../types';
import JsBarcode from 'jsbarcode';

interface EtiquetaProductoProps {
  items: InventoryItem[];
  settings: AppSettings;
  onClose: () => void;
}

const EtiquetaProducto: React.FC<EtiquetaProductoProps> = ({ items, settings, onClose }) => {
  const previewRefs = useRef<(SVGSVGElement | null)[]>([]);

  useEffect(() => {
    items.forEach((item, i) => {
      const el = previewRefs.current[i];
      if (!el) return;
      try {
        JsBarcode(el, item.ref, {
          format: 'CODE128',
          width: 1.5,
          height: 28,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000',
        });
      } catch (e) {
        // ref may contain characters invalid for CODE128 — silently skip
      }
    });
  }, [items]);

  const generateBarcodeSvg = (value: string): string => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(el, value, {
        format: 'CODE128',
        width: 2,
        height: 30,
        displayValue: false,
        margin: 0,
        background: 'transparent',
        lineColor: '#000',
      });
      return el.outerHTML;
    } catch {
      return '';
    }
  };

  const printLabels = () => {
    const labelsHtml = items.map(item => {
      const barcode = generateBarcodeSvg(item.ref);
      const price = (item.salePrice ?? item.costPrice).toFixed(2);
      return `
        <div class="label">
          <div class="label-top">
            <span class="shop-name">${settings.appName}</span>
            <span class="ref-badge">${item.ref}</span>
          </div>
          <div class="desc">${item.description}</div>
          <div class="barcode-row">${barcode}</div>
          <div class="price-row">
            <span class="ref-small">${item.ref}</span>
            <span class="price">${price}€</span>
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiquetas</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: white;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    padding: 2mm;
    gap: 1mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: A4; margin: 5mm; }
  .label {
    width: 60mm;
    height: 40mm;
    border: 0.3mm solid #ccc;
    padding: 2mm 2.5mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .label-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1mm;
    flex-shrink: 0;
  }
  .shop-name {
    font-size: 5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #666;
    letter-spacing: 0.3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 30mm;
  }
  .ref-badge {
    font-size: 5pt;
    font-weight: 900;
    background: #000;
    color: #fff;
    padding: 0.5mm 1.5mm;
    border-radius: 1mm;
    white-space: nowrap;
    max-width: 26mm;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .desc {
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1.2;
    flex: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .barcode-row {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0.5mm 0;
    flex-shrink: 0;
  }
  .barcode-row svg { height: 9mm; max-width: 54mm; }
  .price-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .ref-small { font-size: 5pt; color: #999; font-weight: 700; }
  .price { font-size: 14pt; font-weight: 900; color: #000; line-height: 1; }
</style>
</head>
<body>${labelsHtml}</body>
</html>`;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { try { win.print(); } catch (e) {} }, 800);
      return;
    }
    const id = 'print-labels-frame';
    let iframe = document.getElementById(id) as HTMLIFrameElement;
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) {}
      setTimeout(() => iframe.remove(), 3000);
    }, 600);
  };

  // Preview dimensions: 60mm × 40mm at ~3.78 px/mm → ~227 × 151 px
  const W = 227;
  const H = 151;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Etiquetas de Producto</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {items.length} etiqueta{items.length !== 1 ? 's' : ''} · 60×40 mm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printLabels}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-3 justify-center">
            {items.map((item, i) => {
              const price = (item.salePrice ?? item.costPrice).toFixed(2);
              return (
                <div
                  key={item.id}
                  style={{ width: W, height: H, border: '1px solid #e2e8f0', borderRadius: 4, padding: '6px 7px', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: 'white', overflow: 'hidden', flexShrink: 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{settings.appName}</span>
                    <span style={{ fontSize: 7, fontWeight: 900, background: '#000', color: '#fff', padding: '1px 5px', borderRadius: 3, maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ref}</span>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.2, flex: 1, overflow: 'hidden' }}>
                    {item.description.length > 60 ? item.description.substring(0, 60) + '…' : item.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '3px 0 2px', flexShrink: 0 }}>
                    <svg ref={el => { previewRefs.current[i] = el; }} style={{ maxWidth: '100%', height: 34 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
                    <span style={{ fontSize: 7, color: '#aaa', fontWeight: 700 }}>{item.ref}</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#000', lineHeight: 1 }}>{price}€</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default EtiquetaProducto;
