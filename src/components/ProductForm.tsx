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
  currentStock: string
  minimumStock: string
  desiredStock: string
}

function blankVariant(): DraftVariant {
  return {
    key: crypto.randomUUID(),
    name: '',
    sku: '',
    itemsPerBox: '1',
    price: '0',
    buyingPrice: '0',
    currentStock: '0',
    minimumStock: '',
    desiredStock: '',
  }
}

function priceFromBuying(buyingPrice: string): Partial<DraftVariant> {
  const buying = parseWhole(buyingPrice)
  if (buying !== null && Number.isSafeInteger(buying * 2)) {
    return { buyingPrice, price: String(buying * 2) }
  }
  if (buyingPrice.trim() === '') return { buyingPrice, price: '' }
  return { buyingPrice }
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
    currentStock: String(variant.currentStock),
    minimumStock: String(variant.minimumStock),
    desiredStock: String(variant.desiredStock),
  }))
}

export function ProductForm({
  product,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  product?: Product
  submitLabel: string
  onSubmit: (input: ProductInput) => ActionResult
  onCancel: () => void
}) {
  const formId = useId()
  const [name, setName] = useState(product?.name ?? '')
  const [image, setImage] = useState(product?.image ?? '')
  const [note, setNote] = useState(product?.note ?? '')
  const [variants, setVariants] = useState<DraftVariant[]>(
    product ? fromProduct(product) : [blankVariant()],
  )
  const [error, setError] = useState<string | null>(null)

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
          <span>Product name</span>
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

      <div className="variant-editor">
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
        onClick={() => setVariants((current) => [...current, blankVariant()])}
      >
        Add variant
      </button>

      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
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
  const desired = parseWhole(variant.desiredStock)
  const ready = perBox !== null && perBox >= 1 && current !== null && minimum !== null && desired !== null
  const calc = ready ? calcPurchase(current, desired, perBox) : null
  const short = ready ? needsRestock(current, minimum) : false

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
          <span>SKU</span>
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
        <h4 className="section-label">Price</h4>
        <div className="fields">
          <NumberField
            id={`${formId}-${variant.key}-buying`}
            label="Buying price ₹"
            value={variant.buyingPrice}
            onChange={(buyingPrice) => onChange(priceFromBuying(buyingPrice))}
          />
          <NumberField
            id={`${formId}-${variant.key}-price`}
            label="Selling price ₹"
            value={variant.price}
            onChange={(price) => onChange({ price })}
          />
        </div>
        <p className="hint">Selling price starts at twice the buying price. You can change it.</p>
      </section>
      <section className="form-group">
        <h4 className="section-label">Stock</h4>
        <div className="metrics stock-fields">
          <NumberField
            id={`${formId}-${variant.key}-box`}
            label="Items per box"
            value={variant.itemsPerBox}
            onChange={(itemsPerBox) => onChange({ itemsPerBox })}
          />
          <NumberField
            id={`${formId}-${variant.key}-stock`}
            label="Current stock"
            value={variant.currentStock}
            onChange={(currentStock) => onChange({ currentStock })}
          />
          <NumberField
            id={`${formId}-${variant.key}-min`}
            label="Minimum stock"
            value={variant.minimumStock}
            onChange={(minimumStock) => onChange({ minimumStock })}
          />
          <NumberField
            id={`${formId}-${variant.key}-desired`}
            label="Desired stock"
            value={variant.desiredStock}
            onChange={(desiredStock) => onChange({ desiredStock })}
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
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
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
    const price = parseWhole(variant.price)
    const buyingPrice = parseWhole(variant.buyingPrice)
    const currentStock = parseWhole(variant.currentStock)
    const minimumStock = parseWhole(variant.minimumStock)
    const desiredStock = parseWhole(variant.desiredStock)
    if (itemsPerBox === null) return { ok: false, error: `Enter items per box for ${variantName}.` }
    if (itemsPerBox < 1) return { ok: false, error: `${variantName} needs at least 1 item per box.` }
    if (price === null) return { ok: false, error: `Enter a selling price for ${variantName}.` }
    if (buyingPrice === null) return { ok: false, error: `Enter a buying price for ${variantName}.` }
    if (currentStock === null) return { ok: false, error: `Enter the current stock for ${variantName}.` }
    if (minimumStock === null) return { ok: false, error: `Enter a minimum stock for ${variantName}.` }
    if (desiredStock === null) return { ok: false, error: `Enter a desired stock for ${variantName}.` }

    parsed.push({
      id: variant.id,
      name: variantName,
      sku,
      itemsPerBox,
      price,
      buyingPrice,
      currentStock,
      minimumStock,
      desiredStock,
    })
  }

  return { ok: true, input: { name: name.trim(), image, note: note.trim(), variants: parsed } }
}
