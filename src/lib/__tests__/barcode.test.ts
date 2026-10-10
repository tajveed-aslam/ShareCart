import { cleanBarcode, hasValidCheckDigit, lookupProduct, parseOffResponse, productTitle } from '../barcode'

describe('hasValidCheckDigit', () => {
  it.each([
    ['3017624010701', true], // EAN-13, Nutella
    ['5449000000996', true], // EAN-13, Coca-Cola
    ['96385074', true], // EAN-8
    ['036000291452', true], // UPC-A
    ['3017624010702', false], // last digit misread
    ['301762401070', false], // wrong length for its digits
    ['abc', false],
  ])('%s → %s', (code, valid) => {
    expect(hasValidCheckDigit(code)).toBe(valid)
  })
})

describe('cleanBarcode', () => {
  it('accepts valid product codes and trims spaces', () => {
    expect(cleanBarcode(' 3017624010701 ')).toBe('3017624010701')
    expect(cleanBarcode('3017 6240 10701')).toBe('3017624010701')
  })

  it('rejects misreads so they are rescanned instead of looked up', () => {
    expect(cleanBarcode('3017624010702')).toBeNull()
    expect(cleanBarcode('12')).toBeNull()
    expect(cleanBarcode('hello world!')).toBeNull()
  })

  it('accepts UPC-E and alphanumeric Code 128 values', () => {
    expect(cleanBarcode('0123456')).toBe('0123456')
    expect(cleanBarcode('ABC-1234')).toBe('ABC-1234')
  })
})

describe('Open Food Facts', () => {
  const found = {
    status: 1,
    product: {
      product_name: 'Nutella',
      brands: 'Ferrero, Nutella',
      quantity: '400.0 g',
      image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
    },
  }

  it('parses a found product', () => {
    expect(parseOffResponse('3017624010701', found)).toEqual({
      barcode: '3017624010701',
      name: 'Nutella',
      brand: 'Ferrero',
      size: '400 g',
      imageUrl: 'https://images.openfoodfacts.org/x.jpg',
    })
  })

  it('treats unknown codes and nameless products as not found', () => {
    expect(parseOffResponse('1', { status: 0 })).toBeNull()
    expect(parseOffResponse('1', { status: 1, product: { product_name: '  ' } })).toBeNull()
  })

  it('titles a product with its brand once', () => {
    expect(productTitle({ name: 'Nutella', brand: 'Ferrero' })).toBe('Ferrero Nutella')
    expect(productTitle({ name: 'Heinz Tomato Ketchup', brand: 'Heinz' })).toBe('Heinz Tomato Ketchup')
    expect(productTitle({ name: 'Milk', brand: null })).toBe('Milk')
    expect(productTitle({ name: 'Coca-Cola Original', brand: 'COCA-COLA SERVICES SA/NV' })).toBe('Coca-Cola Original')
    expect(productTitle({ name: 'Original crisps', brand: 'Big Snack Company Holdings Ltd' })).toBe('Original crisps')
    expect(productTitle({ name: 'Ketchup', brand: 'Heinz' })).toBe('Heinz Ketchup')
  })

  it('reports found / not-found / error from the HTTP layer', async () => {
    const respond = (status: number, body: unknown) =>
      jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }) as unknown as typeof fetch
    expect(await lookupProduct('3017624010701', respond(200, found))).toMatchObject({ kind: 'found' })
    expect(await lookupProduct('1234567890128', respond(404, { status: 0 }))).toEqual({ kind: 'not-found' })
    expect(await lookupProduct('1234567890128', respond(200, { status: 0 }))).toEqual({ kind: 'not-found' })
    expect(await lookupProduct('1234567890128', respond(503, {}))).toEqual({ kind: 'error' })
    const offline = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch
    expect(await lookupProduct('1234567890128', offline)).toEqual({ kind: 'error' })
  })
})
