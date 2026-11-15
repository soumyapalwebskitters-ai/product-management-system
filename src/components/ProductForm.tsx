import { useId, useRef, useState, type FormEvent } from 'react'
import { boxesLabel, itemsLabel, parseWhole } from '../format'
import { calcPurchase, needsRestock } from '../purchase'
import { ProductImageField } from './ProductImageField'
import { DUPLICATE_DATA_ERROR, type ActionResult } from '../store'
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
  purchaseQuantityTouched: boolean
  preserveExistingPrices: boolean
  purchaseTotal: string
  manualBuyingPrice: boolean
  sellingUnit: 'box' | 'item'
  manualSellingPrice: boolean
  currentStock: string
  minimumStock: string
  minimumUnit: 'box' | 'item'
  desiredStock: string
  note: string
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
    purchaseQuantityTouched: false,
    preserveExistingPrices: false,
    purchaseTotal: '0',
    manualBuyingPrice: true,
    sellingUnit: 'item',
    manualSellingPrice: false,
    currentStock: '0',
    minimumStock: '2',
    minimumUnit: 'item',
    desiredStock: '5',
    note: '',
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
  const buyingPerItem = buyingPricePerItem(variant)
  const itemsPerBox = parseWhole(variant.itemsPerBox)
  if (buyingPerItem === null || !itemsPerBox) return null
  return variant.sellingUnit === 'box' ? buyingPerItem * itemsPerBox * 2 : buyingPerItem * 2
}

function individualItems(variant: DraftVariant) {
  const quantity = parseWhole(variant.purchaseQuantity)
  const itemsPerBox = parseWhole(variant.itemsPerBox)
  if (quantity === null || quantity < 0 || itemsPerBox === null || itemsPerBox < 1) return null
  return variant.purchaseUnit === 'box' ? quantity * itemsPerBox : quantity
}

function buyingPricePerItem(variant: DraftVariant) {
  if (variant.manualBuyingPrice) return parseMoney(variant.buyingPrice)
  const total = parseMoney(variant.purchaseTotal)
  const items = individualItems(variant)
  return total === null || items === null || items === 0 ? null : total / items
}

function parseMoney(value: string) {
  const trimmed = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null
  const amount = Number(trimmed)
  return Number.isFinite(amount) ? amount : null
}

function hasRequiredProductData(name: string, variants: DraftVariant[], product?: Product) {
  if (!name.trim() || variants.length === 0) return false
  return variants.every((variant) => {
    const quantity = parseWhole(variant.purchaseQuantity)
    const total = parseWhole(variant.purchaseTotal)
    const minimum = parseWhole(variant.minimumStock)
    const selling = variant.manualSellingPrice ? parseMoney(variant.price) : automaticSellingPrice(variant)
    const existing = product?.variants.some((saved) => saved.id === variant.id) ?? false
    return Boolean(variant.name.trim()) && quantity !== null && quantity >= 0 && total !== null && total >= 0 &&
      (existing || (quantity > 0 && total > 0)) && minimum !== null && selling !== null
  })
}

function fromProduct(product: Product): DraftVariant[] {
  return product.variants.map((variant) => ({
    key: variant.id,
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    itemsPerBox: String(variant.itemsPerBox),
    price: String((variant.sellingUnit ?? 'item') === 'box' ? variant.price * variant.itemsPerBox : variant.price),
    buyingPrice: String(variant.buyingPrice ?? 0),
    purchaseUnit: variant.purchaseUnit ?? 'item',
    purchaseQuantity: String((variant.purchaseUnit ?? 'item') === 'box' && variant.itemsPerBox > 0 ? Math.floor(variant.currentStock / variant.itemsPerBox) : variant.currentStock),
    purchaseQuantityTouched: false,
    purchaseTotal: String((variant.buyingPrice ?? 0) * variant.currentStock),
    manualBuyingPrice: false,
    sellingUnit: variant.sellingUnit ?? 'item',
    manualSellingPrice: true,
    preserveExistingPrices: true,
    currentStock: String(variant.currentStock),
    minimumStock: String(variant.purchaseUnit === 'box' && variant.minimumStock % variant.itemsPerBox === 0 ? variant.minimumStock / variant.itemsPerBox : variant.minimumStock),
    minimumUnit: variant.purchaseUnit === 'box' && variant.minimumStock % variant.itemsPerBox === 0 ? 'box' : 'item',
    desiredStock: String(variant.desiredStock),
    note: variant.note ?? '',
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
  onSubmit: (input: ProductInput) => ActionResult | Promise<ActionResult>
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
  const [saving, setSaving] = useState(false)
  const submitLock = useRef(false)
  const [reviewing, setReviewing] = useState(Boolean(product))
  const [wizardStep, setWizardStep] = useState(0)
  const canSubmit = hasRequiredProductData(name, variants, product)
  const wizardSteps = [
    { title: 'Product information', variant: null as string | null, section: 'product' },
    ...variants.flatMap((variant, index) => [
      { title: `Variant ${index + 1}: Details`, variant: variant.key, section: 'details' },
      { title: `Variant ${index + 1}: Purchase`, variant: variant.key, section: 'purchase' },
      { title: `Variant ${index + 1}: Selling`, variant: variant.key, section: 'selling' },
      { title: `Variant ${index + 1}: Stock alert`, variant: variant.key, section: 'stock' },
    ]),
  ]
  const currentStep = wizardSteps[Math.min(wizardStep, wizardSteps.length - 1)]
  const stepReady = currentStep?.section === 'product'
    ? Boolean(name.trim())
    : (() => {
        const variant = variants.find((item) => item.key === currentStep?.variant)
        if (!variant || !currentStep) return false
        if (currentStep.section === 'details') return Boolean(variant.name.trim() && variant.sku.trim())
        if (currentStep.section === 'purchase') return Boolean(parseWhole(variant.itemsPerBox) && (parseWhole(variant.purchaseQuantity) ?? 0) > 0 && (parseMoney(variant.purchaseTotal) ?? 0) > 0)
        if (currentStep.section === 'selling') return parseMoney(variant.manualSellingPrice ? variant.price : String(automaticSellingPrice(variant) ?? '')) !== null
        return parseWhole(variant.minimumStock) !== null
      })()

  function updateVariant(key: string, patch: Partial<DraftVariant>) {
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? {
        ...variant,
        ...patch,
        purchaseQuantityTouched: variant.purchaseQuantityTouched || Object.hasOwn(patch, 'purchaseQuantity') || Object.hasOwn(patch, 'purchaseUnit'),
        preserveExistingPrices: variant.preserveExistingPrices && !Object.hasOwn(patch, 'buyingPrice') && !Object.hasOwn(patch, 'price') && !Object.hasOwn(patch, 'manualBuyingPrice') && !Object.hasOwn(patch, 'manualSellingPrice')
          ? !['purchaseQuantity', 'purchaseTotal', 'purchaseUnit', 'itemsPerBox', 'sellingUnit'].some((field) => Object.hasOwn(patch, field))
          : false,
        ...(variant.preserveExistingPrices && !Object.hasOwn(patch, 'buyingPrice') && !Object.hasOwn(patch, 'price') && !Object.hasOwn(patch, 'manualBuyingPrice') && !Object.hasOwn(patch, 'manualSellingPrice') && ['purchaseQuantity', 'purchaseTotal', 'purchaseUnit', 'itemsPerBox'].some((field) => Object.hasOwn(patch, field))
          ? { manualBuyingPrice: false }
          : {}),
      } : variant)),
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitLock.current) return
    const built = buildInput(name, variants, image, note, product)
    if (!built.ok) {
      setError(built.error)
      return
    }
    submitLock.current = true
    setSaving(true)
    try {
      const result = await onSubmit(built.input)
      if (!result.ok) setError(result.error)
    } catch {
      setError('Could not save the product. Please try again.')
    } finally {
      submitLock.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${saving ? 'form-saving ' : ''}${reviewing ? 'product-review-form' : 'product-wizard-form'}`} aria-busy={saving}>
      {error && error !== DUPLICATE_DATA_ERROR && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!reviewing && <div className="wizard-progress">
        <div className="wizard-progress-copy"><strong>{currentStep?.title}</strong><span>Step {wizardStep + 1} of {wizardSteps.length}</span></div>
        <div className="wizard-progress-track"><span style={{ width: `${((wizardStep + 1) / wizardSteps.length) * 100}%` }} /></div>
      </div>}
      <section className="form-group" hidden={!reviewing && currentStep?.section !== 'product'}>
        <div className="review-section-heading"><h3 className="section-label">Product information</h3>{reviewing && <button type="button" className="btn secondary small" onClick={() => { setWizardStep(0); setReviewing(false) }}>Edit in wizard</button>}</div>
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

      {!reviewing && currentStep?.section === 'product' && !name.trim() && <p className="form-next-step">Enter the product name to continue.</p>}
      {(reviewing || currentStep?.section !== 'product') && <><div className="variant-editor">
        {variants.map((variant, index) => (
          (reviewing || variant.key === currentStep?.variant) && <VariantCard
            key={variant.key}
            formId={formId}
            index={index}
            variant={variant}
            canRemove={variants.length > 1}
            onChange={(patch) => updateVariant(variant.key, patch)}
            onRemove={() => setVariants((current) => current.filter((item) => item.key !== variant.key))}
            onlySection={reviewing ? undefined : currentStep?.section}
            onEdit={reviewing ? (section) => { setWizardStep(wizardSteps.findIndex((step) => step.variant === variant.key && step.section === section)); setReviewing(false) } : undefined}
          />
        ))}
      </div>

      {!reviewing && currentStep?.section === 'product' && <button
        type="button"
        className="btn secondary add-variant"
        onClick={() => setVariants((current) => [...current, blankVariant(new Set([...knownSkus, ...current.map((variant) => variant.sku)].map((sku) => sku.toLowerCase())))])}
      >
        Add variant
      </button>}</>}

      {reviewing && <>
        <div className="review-heading"><span>FINAL REVIEW</span><h3>Review &amp; Edit Product</h3><p>Product and variant information at a glance. Edit any field below before saving.</p></div>
        <div className="review-glance">
          <div className="review-glance-product"><strong>{name || 'Untitled product'}</strong><span>{variants.length} {variants.length === 1 ? 'variant' : 'variants'}{note.trim() ? ` · ${note.trim()}` : ''}</span></div>
          {variants.map((variant, index) => <ReviewGlance key={variant.key} variant={variant} index={index} />)}
        </div>
      </>}

      <div className="dialog-actions">
        {!reviewing ? <>
        <button type="button" className="btn secondary" onClick={wizardStep === 0 ? onCancel : () => setWizardStep((step) => step - 1)} disabled={saving}>{wizardStep === 0 ? 'Cancel' : 'Back'}</button>
        <button type="button" className="btn" disabled={saving || !stepReady} onClick={() => wizardStep < wizardSteps.length - 1 ? setWizardStep((step) => step + 1) : setReviewing(true)}>{wizardStep === wizardSteps.length - 1 ? 'Review product' : 'Next'}</button>
        </> : <>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn secondary" onClick={() => { const next = blankVariant(new Set([...knownSkus, ...variants.map((variant) => variant.sku)].map((sku) => sku.toLowerCase()))); setVariants((current) => [...current, next]); setWizardStep(1 + variants.length * 4); setReviewing(false) }} disabled={saving}>Add more variant</button>
        <button type="submit" className="btn" disabled={!canSubmit || saving} title={canSubmit ? undefined : 'Fill in the required fields to save'}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        </>}
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
  onlySection,
  onEdit,
}: {
  formId: string
  index: number
  variant: DraftVariant
  canRemove: boolean
  onChange: (patch: Partial<DraftVariant>) => void
  onRemove: () => void
  onlySection?: string
  onEdit?: (section: string) => void
}) {
  const perBox = parseWhole(variant.itemsPerBox)
  const current = parseWhole(variant.currentStock)
  const minimum = parseWhole(variant.minimumStock)
  const desired = minimum
  const ready = perBox !== null && perBox >= 1 && current !== null && minimum !== null && desired !== null
  const calc = ready ? calcPurchase(current, desired, perBox) : null
  const short = ready ? needsRestock(current, minimum) : false
  const totalIndividualItems = individualItems(variant)
  const calculatedBuying = buyingPricePerItem(variant)
  const calculatedSelling = automaticSellingPrice(variant)
  const enteredSelling = variant.manualSellingPrice ? parseMoney(variant.price) : calculatedSelling
  const sellingUnits = variant.sellingUnit === 'box' ? perBox ?? 1 : 1
  const profitPerSellingUnit = enteredSelling === null || calculatedBuying === null ? null : enteredSelling - calculatedBuying * sellingUnits

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
      <section className="form-group" hidden={Boolean(onlySection && onlySection !== 'details')}>
        <div className="review-section-heading"><h4 className="section-label">Details</h4>{onEdit && <button type="button" className="btn secondary small" onClick={() => onEdit('details')}>Edit in wizard</button>}</div>
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
        <label className="field"><span>Variant note</span><textarea rows={2} value={variant.note} placeholder="Optional note" onChange={(event) => onChange({ note: event.target.value })} /></label>
      </section>
      <section className="form-group" hidden={Boolean(onlySection && onlySection !== 'purchase')}>
        <div className="review-section-heading"><h4 className="section-label">Purchase information</h4>{onEdit && <button type="button" className="btn secondary small" onClick={() => onEdit('purchase')}>Edit in wizard</button>}</div>
        <div className="choice-row" role="group" aria-label="Purchase unit">
          <span>Purchased as <em className="required-mark" aria-label="required">*</em></span>
          <button type="button" aria-pressed={variant.purchaseUnit === 'box'} onClick={() => onChange({ purchaseUnit: 'box', purchaseQuantity: '0', purchaseTotal: '0', buyingPrice: '0', price: '0', manualBuyingPrice: false, manualSellingPrice: false, itemsPerBox: '1' })}>Boxes</button>
          <button type="button" aria-pressed={variant.purchaseUnit === 'item'} onClick={() => onChange({ purchaseUnit: 'item', sellingUnit: 'item', minimumUnit: 'item', purchaseQuantity: '0', purchaseTotal: '0', buyingPrice: '0', price: '0', manualBuyingPrice: false, manualSellingPrice: false })}>Single items</button>
        </div>
        {variant.purchaseUnit === 'box' && <NumberField id={`${formId}-${variant.key}-purchase-items-per-box`} label="Items per box" value={variant.itemsPerBox} onChange={(itemsPerBox) => onChange({ itemsPerBox })} />}
        <div className="fields">
          <NumberField id={`${formId}-${variant.key}-purchase-quantity`} label={variant.purchaseUnit === 'box' ? 'Boxes purchased' : 'Items purchased'} required value={variant.purchaseQuantity} onChange={(purchaseQuantity) => onChange({ purchaseQuantity })} />
          <NumberField id={`${formId}-${variant.key}-purchase-total`} label="Total purchase cost" required value={variant.purchaseTotal} onChange={(purchaseTotal) => onChange({ purchaseTotal })} />
        </div>
        <div className="fields">
          <label className="field"><span>Total individual items</span><input readOnly value={totalIndividualItems?.toLocaleString() ?? ''} /></label>
          <NumberField id={`${formId}-${variant.key}-purchase-buying`} label="Buying price per item" value={variant.manualBuyingPrice ? variant.buyingPrice : calculatedBuying === null ? '' : calculatedBuying.toFixed(2)} onChange={(buyingPrice) => onChange({ buyingPrice, manualBuyingPrice: true })} />
        </div>
        <p className="hint">Buying price per item is calculated from total cost and item quantity. Edit it to override the calculation.</p>
      </section>
      <section className="form-group selling-section" hidden={Boolean(onlySection && onlySection !== 'selling')}>
        <div className="review-section-heading"><h4 className="section-label">Selling information</h4>{onEdit && <button type="button" className="btn secondary small" onClick={() => onEdit('selling')}>Edit in wizard</button>}</div>
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
        <div className="review-calculation"><span>Buying price per {variant.sellingUnit === 'box' ? 'box' : 'piece'}</span><strong>{calculatedBuying === null ? '—' : `₹${(calculatedBuying * sellingUnits).toFixed(2)}`}</strong><span>Profit per selling unit</span><strong className={profitPerSellingUnit !== null && profitPerSellingUnit < 0 ? 'negative' : ''}>{profitPerSellingUnit === null ? '—' : `₹${profitPerSellingUnit.toFixed(2)}`}</strong></div>
        <p className="hint">Selling price is calculated as twice the buying cost. Edit the field to override it.</p>
      </section>
      <section className="form-group" hidden={Boolean(onlySection && onlySection !== 'stock')}>
        <div className="review-section-heading"><h4 className="section-label">Stock alert</h4>{onEdit && <button type="button" className="btn secondary small" onClick={() => onEdit('stock')}>Edit in wizard</button>}</div>
        <div className="choice-row" role="group" aria-label="Minimum stock unit">
          <span>Alert unit</span>
          <button type="button" aria-pressed={variant.minimumUnit === 'item'} onClick={() => onChange({ minimumUnit: 'item' })}>Per item</button>
          <button type="button" disabled={variant.purchaseUnit === 'item'} aria-pressed={variant.minimumUnit === 'box'} onClick={() => onChange({ minimumUnit: 'box' })}>Per box</button>
        </div>
        <div className="metrics stock-fields">
          <NumberField
            id={`${formId}-${variant.key}-min`}
            required
            label={variant.minimumUnit === 'box' ? 'Minimum boxes' : 'Minimum items'}
            value={variant.minimumStock}
            onChange={(minimumStock) => onChange({ minimumStock })}
          />
        </div>
      </section>
      {(!onlySection || onlySection === 'stock') && minimum === 0 && (
        <p className="hint">A minimum of 0 keeps this variant off the purchase list.</p>
      )}
      {(!onlySection || onlySection === 'stock') && ready && desired !== null && minimum !== null && desired < minimum && (
        <p className="hint">
          Desired stock is below the minimum, so buying up to the desired level still leaves this
          variant short.
        </p>
      )}
      {(!onlySection || onlySection === 'stock') && calc && (
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

function ReviewGlance({ variant, index }: { variant: DraftVariant; index: number }) {
  const quantity = parseWhole(variant.purchaseQuantity) ?? 0
  const perBox = parseWhole(variant.itemsPerBox) ?? 1
  const totalItems = variant.purchaseUnit === 'box' ? quantity * perBox : quantity
  const totalCost = parseMoney(variant.purchaseTotal) ?? 0
  const buyingEach = buyingPricePerItem(variant)
  const priceEach = variant.manualSellingPrice ? parseMoney(variant.price) ?? 0 : automaticSellingPrice(variant) ?? 0
  const sellCount = variant.sellingUnit === 'box' ? perBox : 1
  const sellingPrice = variant.sellingUnit === 'box' ? priceEach : priceEach
  const profit = sellingPrice - (buyingEach ?? 0) * sellCount
  return <article className="review-glance-variant">
    <header><strong>Variant {index + 1}: {variant.name || 'Unnamed'}</strong><span>SKU {variant.sku || '—'}</span></header>
    <dl>
      <div><dt>Purchase</dt><dd>{variant.purchaseUnit === 'box' ? `${quantity} ${quantity === 1 ? 'box' : 'boxes'}` : `${quantity} ${quantity === 1 ? 'item' : 'items'}`}</dd></div>
      <div><dt>Items per box</dt><dd>{variant.purchaseUnit === 'box' ? perBox : '—'}</dd></div>
      <div><dt>Total items</dt><dd>{totalItems}</dd></div>
      <div><dt>Purchase cost</dt><dd>₹{totalCost.toFixed(2)}</dd></div>
      <div><dt>Buying / item</dt><dd>{buyingEach === null ? '—' : `₹${buyingEach.toFixed(2)}`}</dd></div>
      <div><dt>Sell as</dt><dd>{variant.sellingUnit === 'box' ? 'Box' : 'Piece'}</dd></div>
      <div><dt>Selling price</dt><dd>₹{sellingPrice.toFixed(2)} / {variant.sellingUnit === 'box' ? 'box' : 'piece'}</dd></div>
      <div><dt>Profit / sale unit</dt><dd className={profit < 0 ? 'negative' : ''}>₹{profit.toFixed(2)}</dd></div>
    </dl>
  </article>
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
  product?: Product,
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
    const enteredPrice = variant.manualSellingPrice ? parseMoney(variant.price) : automaticSellingPrice(variant)
    const purchaseQuantity = parseWhole(variant.purchaseQuantity)
    const purchaseTotal = parseWhole(variant.purchaseTotal)
    const minimumStock = parseWhole(variant.minimumStock)
    const existing = product?.variants.find((saved) => saved.id === variant.id)
    if (itemsPerBox === null) return { ok: false, error: `Enter items per box for ${variantName}.` }
    if (itemsPerBox < 1) return { ok: false, error: `${variantName} needs at least 1 item per box.` }
    if (enteredPrice === null) return { ok: false, error: `Enter a selling price for ${variantName}.` }
    if (purchaseQuantity === null || purchaseQuantity < (existing ? 0 : 1) || purchaseTotal === null || purchaseTotal < 0 ||
      (!existing && purchaseTotal === 0) || (purchaseQuantity === 0 && purchaseTotal > 0)) {
      return { ok: false, error: `Enter purchase quantity and total cost for ${variantName}.` }
    }
    if (variant.manualBuyingPrice && parseMoney(variant.buyingPrice) === null) return { ok: false, error: `Enter a manual buying price for ${variantName}.` }
    if (minimumStock === null) return { ok: false, error: `Enter a minimum stock for ${variantName}.` }

    parsed.push({
      id: variant.id,
      name: variantName,
      sku,
      itemsPerBox,
      price: variant.sellingUnit === 'box' ? enteredPrice / itemsPerBox : enteredPrice,
      buyingPrice: variant.manualBuyingPrice
        ? (parseMoney(variant.buyingPrice) ?? 0)
        : purchaseQuantity > 0
          ? purchaseTotal / (variant.purchaseUnit === 'box' ? purchaseQuantity * itemsPerBox : purchaseQuantity)
          : existing?.buyingPrice ?? 0,
      purchaseUnit: variant.purchaseUnit,
      sellingUnit: variant.sellingUnit,
      currentStock: purchaseQuantity === 0 && existing
        ? existing.currentStock
        : existing && !variant.purchaseQuantityTouched
          ? existing.currentStock
          : variant.purchaseUnit === 'box' ? purchaseQuantity * itemsPerBox : purchaseQuantity,
      minimumStock: variant.minimumUnit === 'box' ? minimumStock * itemsPerBox : minimumStock,
      desiredStock: existing?.desiredStock ?? (variant.minimumUnit === 'box' ? minimumStock * itemsPerBox : minimumStock),
      note: variant.note.trim(),
    })
  }

  return { ok: true, input: { name: name.trim(), image, note: note.trim(), variants: parsed } }
}
