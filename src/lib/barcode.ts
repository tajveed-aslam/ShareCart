/** Barcode helpers and the Open Food Facts product lookup (free, no key; https://openfoodfacts.github.io/). */

/** The symbologies found on groceries. QR codes aren't products, so they're not scanned. */
export const PRODUCT_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const

/**
 * GS1 check digit for EAN-8 / UPC-A (12) / EAN-13 / GTIN-14: from the right, digits alternate weights 3 and 1.
 * A camera misread almost always breaks it, so failed checks are rescanned instead of looked up.
 */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false
  const digits = [...code].map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** Trims and validates a scanned or typed barcode. Returns null if it can't be a product code. */
export function cleanBarcode(raw: string): string | null {
  const code = raw.trim().replace(/\s+/g, '')
  if (/^\d+$/.test(code)) {
    if ([8, 12, 13, 14].includes(code.length)) return hasValidCheckDigit(code) ? code : null
    return code.length >= 6 && code.length <= 14 ? code : null // UPC-E and in-store codes: no check we can apply
  }
  return /^[0-9A-Za-z-]{4,64}$/.test(code) ? code : null // Code 128 can carry letters
}

export interface Product {
  barcode: string
  name: string
  brand: string | null
  /** Pack size as printed, e.g. "400 g". */
  size: string | null
  imageUrl: string | null
}

interface OffResponse {
  status?: number
  product?: { product_name?: string; product_name_en?: string; brands?: string; quantity?: string; image_front_small_url?: string }
}

/** Turns an Open Food Facts response into a Product, or null when the barcode isn't in their database. */
export function parseOffResponse(barcode: string, json: OffResponse): Product | null {
  const p = json.product
  if (json.status !== 1 || !p) return null
  const name = (p.product_name || p.product_name_en || '').trim()
  if (!name) return null
  const brand = p.brands?.split(',')[0]?.trim() || null
  const size = p.quantity?.trim().replace(/\.0\b/, '') || null
  return { barcode, name, brand, size, imageUrl: p.image_front_small_url ?? null }
}

/** "Nutella" + "Ferrero" → "Ferrero Nutella", unless the name already contains the brand. */
export function productTitle(product: Pick<Product, 'name' | 'brand'>): string {
  const { name, brand } = product
  if (!brand || name.toLowerCase().includes(brand.toLowerCase())) return name
  return `${brand} ${name}`
}

export type LookupResult = { kind: 'found'; product: Product } | { kind: 'not-found' } | { kind: 'error' }

export async function lookupProduct(barcode: string, fetchImpl: typeof fetch = fetch): Promise<LookupResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetchImpl(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,quantity,image_front_small_url`,
      { signal: controller.signal },
    )
    if (res.status === 404) return { kind: 'not-found' }
    if (!res.ok) return { kind: 'error' }
    const product = parseOffResponse(barcode, (await res.json()) as OffResponse)
    return product ? { kind: 'found', product } : { kind: 'not-found' }
  } catch {
    return { kind: 'error' }
  } finally {
    clearTimeout(timer)
  }
}
