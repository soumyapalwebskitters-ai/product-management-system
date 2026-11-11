import { useId, useState, type FormEvent } from 'react'
import { boxesLabel, itemsLabel, parseWhole } from '../format'
import { calcPurchase, needsRestock } from '../purchase'
import { ProductImageField } from './ProductImageField'
import type { ActionResult } from '../store'
import type { Product, ProductInput, VariantInput } from '../types'

type DraftVariant = {
  key: string
  id?: string
  name: string
  sku: string
  itemsPerBox: string
  price: string
  buyingPrice: string
  purchaseUnit: 'box' | 'item'
  purchaseQuantity: string
  purchaseTotal: string
  manualBuyingPrice: boolean
  sellingUnit: 'box' | 'item'
  manualSellingPrice: boolean
  currentStock: string
  minimumStock: string
  desiredStock: string
}

function blankVariant(usedSkus: Set<string>): DraftVariant {
  return {
    key: crypto.randomUUID(),
    name: '',
    sku: generateSku(usedSkus),
    itemsPerBox: '1',
    price: '0',
    buyingPrice: '0',
    purchaseUnit: 'box',
    purchaseQuantity: '0',
    purchaseTotal: '0',
    manualBuyingPrice: false,
    sellingUnit: 'item',
    manualSellingPrice: false,
    currentStock: '0',
    minimumStock: '2',
    desiredStock: '5',
  }
}

function generateSku(usedSkus: Set<string>) {
  let sku: string
  do {
    sku = `PRD-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
  } while (usedSkus.has(sku.toLowerCase()))
  return sku
}

function automaticSellingPrice(variant: DraftVariant) {
  const quantity = parseWhole(variant.purchaseQuantity)
  const total = parseWhole(variant.purchaseTotal)
  const itemsPerBox = parseWhole(variant.itemsPerBox)
  if (!quantity || total === null || !itemsPerBox) return null
  const buyingPerItem = variant.purchaseUnit === 'box' ? total / (quantity * itemsPerBox) : total / quantity
  return variant.sellingUnit === 'box' ? buyingPerItem * itemsPerBox * 2 : buyingPerItem * 2
}

function hasRequiredProductData(name: string, variants: DraftVariant[]) {
  if (!name.trim() || variants.length === 0) return false
  return variants.every((variant) => {
    const quantity = parseWhole(variant.purchaseQuantity)
    const total = parseWhole(variant.purchaseTotal)
    const minimum = parseWhole(variant.minimumStock)
    const selling = variant.manualSellingPrice ? parseWhole(variant.price) : automaticSellingPrice(variant)
    return Boolean(variant.name.trim()) && quantity !== null && quantity > 0 && total !== null && total > 0 && minimum !== null && selling !== null
  })
}

function fromProduct(product: Product): DraftVariant[] {
  return product.variants.map((variant) => ({
    key: variant.id,
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    itemsPerBox: String(variant.itemsPerBox),
    price: String(variant.price),
    buyingPrice: String(variant.buyingPrice ?? 0),
    purchaseUnit: 'item',
    purchaseQuantity: String(variant.currentStock),
    purchaseTotal: String((variant.buyingPrice ?? 0) * variant.currentStock),
    manualBuyingPrice: false,
    sellingUnit: 'item',
    manualSellingPrice: true,
    currentStock: String(variant.currentStock),
    minimumStock: String(variant.minimumStock),
    desiredStock: String(variant.desiredStock),
  }))
}

export function ProductForm({
  product,
  knownSkus,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  product?: Product
  knownSkus: string[]
  submitLabel: string
  onSubmit: (input: ProductInput) => ActionResult
  onCancel: () => void
}) {
  const formId = useId()
  const [name, setName] = useState(product?.name ?? '')
  const [image, setImage] = useState(product?.image ?? '')
  const [note, setNote] = useState(product?.note ?? '')
  const [variants, setVariants] = useState<DraftVariant[]>(
    product ? fromProduct(product) : [blankVariant(new Set(knownSkus.map((sku) => sku.toLowerCase())))],
  )
  const [error, setError] = useState<string | null>(null)
  const canSubmit = hasRequiredProductData(name, variants)

  function updateVariant(key: string, patch: Partial<DraftVariant>) {
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)),
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const built = buildInput(name, variants, image, note)
    if (!built.ok) {
      setError(built.error)
      return
    }
    const result = onSubmit(built.input)
    if (!result.ok) setError(result.error)
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="form-group">
        <h3 className="section-label">Product</h3>
        <label className="field" htmlFor={`${formId}-name`}>
          <span>Product name <em className="required-mark" aria-label="required">*</em></span>
          <input
            id={`${formId}-name`}
            value={name}
            autoFocus
            autoComplete="off"
            placeholder="Flower Pots"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <ProductImageField image={image} onChange={setImage} />
        <label className="field" htmlFor={`${formId}-note`}>
          <span>Note</span>
          <textarea
            id={`${formId}-note`}
            value={note}
            rows={3}
            placeholder="Pack size, supplier, or anything to remember"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </section>

      {!name.trim() && <p className="form-next-step">Enter the product name to add its variants.</p>}
      {name.trim() && <><div className="variant-editor">
        {variants.map((variant, index) => (
          <VariantCard
            key={variant.key}
            formId={formId}
            index={index}
            variant={variant}
            canRemove={variants.length > 1}
            onChange={(patch) => updateVariant(variant.key, patch)}
            onRemove={() => setVariants((current) => current.filter((item) => item.key !== variant.key))}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn secondary add-variant"
        onClick={() => setVariants((current) => [...current, blankVariant(new Set([...knownSkus, ...current.map((variant) => variant.sku)].map((sku) => sku.toLowerCase())))])}
      >
        Add variant
      </button></>}

      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={!canSubmit} title={canSubmit ? undefined : 'Fill in the required fields to save'}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function VariantCard({
  formId,
  index,
  variant,
  canRemove,
  onChange,
  onRemove,
}: {
  formId: string
  index: number
  variant: DraftVariant
  canRemove: boolean
  onChange: (patch: Partial<DraftVariant>) => void
  onRemove: () => void
}) {
  const perBox = parseWhole(variant.itemsPerBox)
  const current = parseWhole(variant.currentStock)
  const minimum = parseWhole(variant.minimumStock)
  const desired = minimum
  const ready = perBox !== null && perBox >= 1 && current !== null && minimum !== null && desired !== null
  const calc = ready ? calcPurchase(current, desired, perBox) : null
  const short = ready ? needsRestock(current, minimum) : false
  const purchaseQuantity = parseWhole(variant.purchaseQuantity)
  const purchaseTotal = parseWhole(variant.purchaseTotal)
  const calculatedBuying = purchaseQuantity && purchaseTotal !== null ? purchaseTotal / purchaseQuantity : null
  const calculatedSelling = automaticSellingPrice(variant)

  return (
    <article className="variant-card">
      <header>
        <h3>Variant {index + 1}</h3>
        <button
          type="button"
          className="btn danger-text small"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? 'Remove variant' : 'A product needs at least one variant'}
        >
          Remove
        </button>
      </header>
      <section className="form-group">
        <h4 className="section-label">Details</h4>
        <div className="fields">
        <label className="field" htmlFor={`${formId}-${variant.key}-name`}>
          <span>Variant name</span>
          <input
            id={`${formId}-${variant.key}-name`}
            value={variant.name}
            autoComplete="off"
            placeholder="Small"
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <label className="field" htmlFor={`${formId}-${variant.key}-sku`}>
          <span>SKU <small className="field-note">Generated automatically</small></span>
          <input
            id={`${formId}-${variant.key}-sku`}
            value={variant.sku}
            autoComplete="off"
            spellCheck={false}
            placeholder="FP-S"
            onChange={(event) => onChange({ sku: event.target.value })}
          />
        </label>
        </div>
      </section>
      <section className="form-group">
        <h4 className="section-label">Purchase quantity</h4>
        <div className="choice-row" role="group" aria-label="Purchase unit">
          <span>Purchased as <em className="required-mark" aria-label="required">*</em></span>
          <button type="button" aria-pressed={variant.purchaseUnit === 'box'} onClick={() => onChange({ purchaseUnit: 'box', purchaseQuantity: '0', purchaseTotal: '0', buyingPrice: '0', price: '0', manualBuyingPrice: false, manualSellingPrice: false, itemsPerBox: '1' })}>Boxes</button>
          <button type="button" aria-pressed={variant.purchaseUnit === 'item'} onClick={() => onChange({ purchaseUnit: 'item', sellingUnit: 'item', purchaseQuantity: '0', purchaseTotal: '0', buyingPrice: '0', price: '0', manualBuyingPrice: false, manualSellingPrice: false })}>Single items</button>
        </div>
        {variant.purchaseUnit === 'box' && <NumberField id={`${formId}-${variant.key}-purchase-items-per-box`} label="Items per box" value={variant.itemsPerBox} onChange={(itemsPerBox) => onChange({ itemsPerBox })} />}
        <div className="fields">
          <NumberField id={`${formId}-${variant.key}-purchase-quantity`} label={variant.purchaseUnit === 'box' ? 'Boxes purchased' : 'Items purchased'} required value={variant.purchaseQuantity} onChange={(purchaseQuantity) => onChange({ purchaseQuantity })} />
          <NumberField id={`${formId}-${variant.key}-purchase-total`} label="Total purchase cost" required value={variant.purchaseTotal} onChange={(purchaseTotal) => onChange({ purchaseTotal })} />
        </div>
        <NumberField id={`${formId}-${variant.key}-purchase-buying`} label="Buying price" value={variant.manualBuyingPrice ? variant.buyingPrice : calculatedBuying === null ? '' : (calculatedBuying ?? 0).toFixed(2)} onChange={(buyingPrice) => onChange({ buyingPrice, manualBuyingPrice: true })} />
      </section>
      <section className="form-group selling-section">
        <h4 className="section-label">Selling price</h4>
        <div className="choice-row" role="group" aria-label="Selling unit">
          <span>Sell as</span>
          <button type="button" aria-pressed={variant.sellingUnit === 'item'} onClick={() => onChange({ sellingUnit: 'item', manualSellingPrice: false })}>Single item</button>
          <button type="button" aria-pressed={variant.sellingUnit === 'box'} disabled={variant.purchaseUnit === 'item'} onClick={() => onChange({ sellingUnit: 'box', manualSellingPrice: false })}>Full box</button>
        </div>
        <div className="fields">
          {false && <NumberField
            id={`${formId}-${variant.key}-buying`}
            label="Buying price ₹"
            value={variant.manualBuyingPrice ? variant.buyingPrice : calculatedBuying === null ? '' : (calculatedBuying ?? 0).toFixed(2)}
            onChange={(buyingPrice) => onChange({ buyingPrice, manualBuyingPrice: true })}
          />}
          <NumberField
            id={`${formId}-${variant.key}-price`}
            required
            label="Selling price ₹"
            value={variant.manualSellingPrice ? variant.price : calculatedSelling === null ? '' : calculatedSelling.toFixed(2)}
            onChange={(price) => onChange({ price, manualSellingPrice: true })}
          />
        </div>
        <p className="hint">Buying price and selling price are calculated from purchase quantity and total cost. Edit either field to override it manually.</p>
      </section>
      <section className="form-group">
        <h4 className="section-label">Stock alert</h4>
        <div className="metrics stock-fields">
          <NumberField
            id={`${formId}-${variant.key}-min`}
            required
            label="Minimum stock"
            value={variant.minimumStock}
            onChange={(minimumStock) => onChange({ minimumStock })}
          />
        </div>
      </section>
      {minimum === 0 && (
        <p className="hint">A minimum of 0 keeps this variant off the purchase list.</p>
      )}
      {ready && desired !== null && minimum !== null && desired < minimum && (
        <p className="hint">
          Desired stock is below the minimum, so buying up to the desired level still leaves this
          variant short.
        </p>
      )}
      {calc && (
        <p className="preview">
          {short
            ? `Short by ${itemsLabel(calc.purchaseQty)}. Buy ${boxesLabel(calc.boxes)} (${calc.totalItems.toLocaleString()} items, ${calc.extra.toLocaleString()} extra).`
            : current === minimum
              ? 'At the minimum stock.'
              : 'Above the minimum stock.'}
        </p>
      )}
    </article>
  )
}

function NumberField({
  id,
  label,
  required = false,
  value,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}{required && <> <em className="required-mark" aria-label="required">*</em></>}</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onWheel={(event) => event.currentTarget.blur()}
      />
    </label>
  )
}

function buildInput(
  name: string,
  variants: DraftVariant[],
  image: string,
  note: string,
): { ok: true; input: ProductInput } | { ok: false; error: string } {
  if (!name.trim()) return { ok: false, error: 'Enter a product name.' }
  if (variants.length === 0) return { ok: false, error: 'Add at least one variant.' }

  const parsed: VariantInput[] = []
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index]
    const variantName = variant.name.trim()
    const sku = variant.sku.trim()
    if (!variantName) return { ok: false, error: `Enter a name for variant ${index + 1}.` }
    if (!sku) return { ok: false, error: `Enter a SKU for ${variantName}.` }

    const itemsPerBox = parseWhole(variant.itemsPerBox)
    const enteredPrice = variant.manualSellingPrice ? parseWhole(variant.price) : automaticSellingPrice(variant)
    const purchaseQuantity = parseWhole(variant.purchaseQuantity)
    const purchaseTotal = parseWhole(variant.purchaseTotal)
    const minimumStock = parseWhole(variant.minimumStock)
    if (itemsPerBox === null) return { ok: false, error: `Enter items per box for ${variantName}.` }
    if (itemsPerBox < 1) return { ok: false, error: `${variantName} needs at least 1 item per box.` }
    if (enteredPrice === null) return { ok: false, error: `Enter a selling price for ${variantName}.` }
    if (purchaseQuantity === null || purchaseQuantity < 1 || purchaseTotal === null) return { ok: false, error: `Enter purchase quantity and total cost for ${variantName}.` }
    if (variant.manualBuyingPrice && parseWhole(variant.buyingPrice) === null) return { ok: false, error: `Enter a manual buying price for ${variantName}.` }
    if (minimumStock === null) return { ok: false, error: `Enter a minimum stock for ${variantName}.` }

    parsed.push({
      id: variant.id,
      name: variantName,
      sku,
      itemsPerBox,
      price: variant.sellingUnit === 'box' ? enteredPrice / itemsPerBox : enteredPrice,
      buyingPrice: variant.manualBuyingPrice
        ? (parseWhole(variant.buyingPrice) ?? 0) / (variant.purchaseUnit === 'box' ? itemsPerBox : 1)
        : purchaseTotal / (variant.purchaseUnit === 'box' ? purchaseQuantity * itemsPerBox : purchaseQuantity),
      purchaseUnit: variant.purchaseUnit,
      currentStock: variant.purchaseUnit === 'box' ? purchaseQuantity * itemsPerBox : purchaseQuantity,
      minimumStock,
      desiredStock: minimumStock,
    })
  }

  return { ok: true, input: { name: name.trim(), image, note: note.trim(), variants: parsed } }
}
