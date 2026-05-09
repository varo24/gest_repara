import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage'
import { fbStorage } from './firebase'

function sanitize(s: string): string {
  return (s || 'sin-nombre')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .slice(0, 80)
}

// base64 → Uint8Array (handles data URIs too)
function base64ToBytes(b64: string): Uint8Array {
  const pure = b64.includes(',') ? b64.split(',')[1] : b64
  const bin = atob(pure)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function uploadFacturaPDF(
  pdfBase64: string,
  proveedor: string,
  numeroFactura: string,
  fecha: string,
): Promise<string> {
  const d = fecha ? new Date(fecha) : new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const provSlug = sanitize(proveedor)
  const numSlug = sanitize(numeroFactura)
  const path = `facturas-proveedores/${provSlug}/${year}/${month}/${numSlug}.pdf`

  const bytes = base64ToBytes(pdfBase64)
  const storageRef = ref(fbStorage, path)
  await uploadBytes(storageRef, bytes, { contentType: 'application/pdf' })
  return getDownloadURL(storageRef)
}

export interface ArchivoFactura {
  path: string
  name: string
  proveedor: string
  year: string
  month: string
  url: string
}

export async function getFacturasProveedores(): Promise<ArchivoFactura[]> {
  const rootRef = ref(fbStorage, 'facturas-proveedores')
  const result: ArchivoFactura[] = []

  try {
    const proveedores = await listAll(rootRef)
    for (const provRef of proveedores.prefixes) {
      const proveedor = provRef.name
      const years = await listAll(provRef)
      for (const yearRef of years.prefixes) {
        const year = yearRef.name
        const months = await listAll(yearRef)
        for (const monthRef of months.prefixes) {
          const month = monthRef.name
          const files = await listAll(monthRef)
          for (const fileRef of files.items) {
            try {
              const url = await getDownloadURL(fileRef)
              result.push({ path: fileRef.fullPath, name: fileRef.name, proveedor, year, month, url })
            } catch { /* skip inaccessible files */ }
          }
        }
      }
    }
  } catch { /* returns empty list if root doesn't exist yet */ }

  return result
}

export async function deleteFacturaPDF(path: string): Promise<void> {
  await deleteObject(ref(fbStorage, path))
}

// Upload a File object directly (for manual upload from disk)
export async function uploadFacturaFile(
  file: File,
  proveedor: string,
  numeroFactura: string,
  fecha: string,
): Promise<string> {
  const d = fecha ? new Date(fecha) : new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const provSlug = sanitize(proveedor)
  const numSlug = sanitize(numeroFactura)
  const path = `facturas-proveedores/${provSlug}/${year}/${month}/${numSlug}.pdf`
  const storageRef = ref(fbStorage, path)
  await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
  return getDownloadURL(storageRef)
}
