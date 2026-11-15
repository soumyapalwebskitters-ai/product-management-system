<<<<<<< HEAD
import { useMemo, useState, type FormEvent } from 'react'
import type { SearchMode } from '../search'
import { rupees } from '../format'
import { parseWhole } from '../format'
import type { OfferInput } from '../offers'
import { DUPLICATE_DATA_ERROR, type ActionResult } from '../store'
import type { Offer, OfferGift, State } from '../types'
import { ProductSelect, type SelectOption } from './ProductSelect'

export function OfferForm({
  state,
  offer,
  onSubmit,
  onCancel,
}: {
  state: State
  offer?: Offer
  onSubmit: (input: OfferInput, offerId: string | null) => ActionResult
  onCancel: () => void
}) {
  const [name, setName] = useState(offer?.name ?? '')
  const [minimum, setMinimum] = useState(offer ? String(offer.minimumAmount) : '')
  const [reward, setReward] = useState<'discount' | 'gift'>(offer?.reward ?? 'discount')
  const [percent, setPercent] = useState(offer?.reward === 'discount' ? String(offer.percent) : '10')
  const [gifts, setGifts] = useState<Array<OfferGift & { id: string }>>(() => {
    if (offer?.reward !== 'gift') return []
    const saved = offer.giftItems?.length ? offer.giftItems : [offer]
    return saved.map((gift) => ({ ...gift, id: `${gift.productId}:${gift.variantId}` }))
  })
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [error, setError] = useState<string | null>(null)

  const options = useMemo<SelectOption[]>(
    () =>
      state.products.flatMap((product) =>
        product.variants.map((variant) => ({
          id: `${product.id}:${variant.id}`,
          title: `${product.name} Â· ${variant.name}`,
          meta: variant.sku,
          searchText: `${product.name} ${variant.name} ${variant.sku}`,
        })),
      ),
    [state.products],
  )
  const selectedGiftIds = gifts.map((gift) => gift.id)
  const giftDetails = gifts.map((gift) => {
    const product = state.products.find((item) => item.id === gift.productId)
    const variant = product?.variants.find((item) => item.id === gift.variantId)
    const pieces = gift.quantity * ((gift.quantityUnit ?? 'item') === 'box' ? variant?.itemsPerBox ?? 1 : 1)
    return { gift, product, variant, pieces }
  })

=======
import { useMemo, useState, type FormEvent } from 'react'
import type { SearchMode } from '../search'
import { rupees } from '../format'
import { parseWhole } from '../format'
import type { OfferInput } from '../offers'
import { DUPLICATE_DATA_ERROR, type ActionResult } from '../store'
import type { Offer, OfferGift, State } from '../types'
import { ProductSelect, type SelectOption } from './ProductSelect'

export function OfferForm({
  state,
  offer,
  onSubmit,
  onCancel,
}: {
  state: State
  offer?: Offer
  onSubmit: (input: OfferInput, offerId: string | null) => ActionResult
  onCancel: () => void
}) {
  const [name, setName] = useState(offer?.name ?? '')
  const [minimum, setMinimum] = useState(offer ? String(offer.minimumAmount) : '')
  const [reward, setReward] = useState<'discount' | 'gift'>(offer?.reward ?? 'discount')
  const [percent, setPercent] = useState(offer?.reward === 'discount' ? String(offer.percent) : '10')
  const [gifts, setGifts] = useState<Array<OfferGift & { id: string }>>(() => {
    if (offer?.reward !== 'gift') return []
    const saved = offer.giftItems?.length ? offer.giftItems : [offer]
    return saved.map((gift) => ({ ...gift, id: `${gift.productId}:${gift.variantId}` }))
  })
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [error, setError] = useState<string | null>(null)

  const options = useMemo<SelectOption[]>(
    () =>
      state.products.flatMap((product) =>
        product.variants.map((variant) => ({
          id: `${product.id}:${variant.id}`,
          title: `${product.name} Â· ${variant.name}`,
          meta: variant.sku,
          searchText: `${product.name} ${variant.name} ${variant.sku}`,
        })),
      ),
    [state.products],
  )
  const selectedGiftIds = gifts.map((gift) => gift.id)
  const giftDetails = gifts.map((gift) => {
    const product = state.products.find((item) => item.id === gift.productId)
    const variant = product?.variants.find((item) => item.id === gift.variantId)
    const pieces = gift.quantity * ((gift.quantityUnit ?? 'item') === 'box' ? variant?.itemsPerBox ?? 1 : 1)
    return { gift, product, variant, pieces }
  })

>>>>>>> 1e93a50f783b841383173e99bc31d39d2d1aeb4b
  function selectGifts(ids: string[]) {
    setGifts((current) => ids.map((id) => {
      const found = current.find((gift) => gift.id === id)
      if (found) return found
      const [productId, variantId] = id.split(':')
      return { id, productId, variantId, quantity: 1, quantityUnit: 'item' }
    }))
<<<<<<< HEAD
  }

  function updateGift(id: string, changes: Partial<OfferGift>) {
    setGifts((current) => current.map((gift) => gift.id === id ? { ...gift, ...changes } : gift))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const minimumAmount = parseWhole(minimum)
    const parsedPercent = parseWhole(percent)
    if (!name.trim()) {
      setError('Enter a name for the offer.')
      return
    }
    if (minimumAmount === null || minimumAmount < 1) {
      setError('Enter the purchase amount that unlocks this offer.')
      return
    }
    const giftItems = gifts.map(({ id: _id, ...gift }) => ({ ...gift, quantity: parseWhole(String(gift.quantity)) ?? 0 }))
    const result = onSubmit(
      {
        name,
        minimumAmount,
        reward,
        percent: reward === 'discount' ? parsedPercent ?? 0 : 0,
        productId: reward === 'gift' ? giftItems[0]?.productId ?? '' : '',
        variantId: reward === 'gift' ? giftItems[0]?.variantId ?? '' : '',
        quantity: reward === 'gift' ? giftItems[0]?.quantity ?? 0 : 0,
        quantityUnit: reward === 'gift' ? giftItems[0]?.quantityUnit ?? 'item' : 'item',
        giftItems: reward === 'gift' ? giftItems : [],
      },
      offer?.id ?? null,
    )
    if (!result.ok) setError(result.error)
  }

  return (
    <form onSubmit={submit}>
      {error && error !== DUPLICATE_DATA_ERROR && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        <span>Offer name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Festival discount" />
      </label>
      <label className="field">
        <span>Purchase amount</span>
        <input
          inputMode="numeric"
          value={minimum}
          placeholder="200"
          onChange={(event) => setMinimum(event.target.value)}
        />
      </label>
      <p className="hint">When the bill reaches this amount, the buyer receives this one reward.</p>
      <div className="filters offer-reward-choice" role="group" aria-label="Reward">
        <button
          type="button"
          className="chip"
          aria-pressed={reward === 'discount'}
          onClick={() => setReward('discount')}
        >
          Cash discount
        </button>
        <button type="button" className="chip" aria-pressed={reward === 'gift'} onClick={() => setReward('gift')}>
          Gift items
        </button>
      </div>
      {reward === 'discount' ? (
        <label className="field">
          <span>Discount percent</span>
          <input inputMode="numeric" value={percent} onChange={(event) => setPercent(event.target.value)} />
        </label>
      ) : (
        <>
=======
  }

  function updateGift(id: string, changes: Partial<OfferGift>) {
    setGifts((current) => current.map((gift) => gift.id === id ? { ...gift, ...changes } : gift))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const minimumAmount = parseWhole(minimum)
    const parsedPercent = parseWhole(percent)
    if (!name.trim()) {
      setError('Enter a name for the offer.')
      return
    }
    if (minimumAmount === null || minimumAmount < 1) {
      setError('Enter the purchase amount that unlocks this offer.')
      return
    }
    const giftItems = gifts.map(({ id: _id, ...gift }) => ({ ...gift, quantity: parseWhole(String(gift.quantity)) ?? 0 }))
    const result = onSubmit(
      {
        name,
        minimumAmount,
        reward,
        percent: reward === 'discount' ? parsedPercent ?? 0 : 0,
        productId: reward === 'gift' ? giftItems[0]?.productId ?? '' : '',
        variantId: reward === 'gift' ? giftItems[0]?.variantId ?? '' : '',
        quantity: reward === 'gift' ? giftItems[0]?.quantity ?? 0 : 0,
        quantityUnit: reward === 'gift' ? giftItems[0]?.quantityUnit ?? 'item' : 'item',
        giftItems: reward === 'gift' ? giftItems : [],
      },
      offer?.id ?? null,
    )
    if (!result.ok) setError(result.error)
  }

  return (
    <form onSubmit={submit}>
      {error && error !== DUPLICATE_DATA_ERROR && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        <span>Offer name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Festival discount" />
      </label>
      <label className="field">
        <span>Purchase amount</span>
        <input
          inputMode="numeric"
          value={minimum}
          placeholder="200"
          onChange={(event) => setMinimum(event.target.value)}
        />
      </label>
      <p className="hint">When the bill reaches this amount, the buyer receives this one reward.</p>
      <div className="filters offer-reward-choice" role="group" aria-label="Reward">
        <button
          type="button"
          className="chip"
          aria-pressed={reward === 'discount'}
          onClick={() => setReward('discount')}
        >
          Cash discount
        </button>
        <button type="button" className="chip" aria-pressed={reward === 'gift'} onClick={() => setReward('gift')}>
          Gift items
        </button>
      </div>
      {reward === 'discount' ? (
        <label className="field">
          <span>Discount percent</span>
          <input inputMode="numeric" value={percent} onChange={(event) => setPercent(event.target.value)} />
        </label>
      ) : (
        <>
>>>>>>> 1e93a50f783b841383173e99bc31d39d2d1aeb4b
          <div className="field">
            <span>Gift items</span>
            <ProductSelect
              label="Gift items"
              placeholder="Select one or more gifts"
              options={options}
              query={query}
              mode={searchMode}
              selectedId={null}
              selectedIds={selectedGiftIds}
              multiple
              onQueryChange={setQuery}
              onModeChange={setSearchMode}
              onSelect={() => undefined}
              onMultiSelect={selectGifts}
              inline
            />
          </div>
          {giftDetails.map(({ gift, product, variant, pieces }) => (
            <div className="form-section" key={gift.id}>
              <p className="field-label">{product?.name} · {variant?.name}</p>
              <div className="choice-row" role="group" aria-label={`${product?.name} gift quantity unit`}>
                <span>Give as</span>
                <button type="button" aria-pressed={(gift.quantityUnit ?? 'item') === 'item'} onClick={() => updateGift(gift.id, { quantityUnit: 'item' })}>Pieces</button>
                <button type="button" aria-pressed={gift.quantityUnit === 'box'} onClick={() => updateGift(gift.id, { quantityUnit: 'box' })}>Boxes</button>
              </div>
              <label className="field">
                <span>Free {gift.quantityUnit === 'box' ? 'boxes' : 'pieces'}</span>
                <input inputMode="numeric" value={gift.quantity} onChange={(event) => updateGift(gift.id, { quantity: parseWhole(event.target.value) ?? 0 })} />
              </label>
              {variant && <p className="preview">Seller only: purchase cost {rupees((variant.buyingPrice ?? 0) * pieces)} · retail value {rupees(variant.price * pieces)}</p>}
            </div>
          ))}
<<<<<<< HEAD
          {gifts.length > 0 && <p className="hint">Every selected gift is added to the buyer's order and deducted from stock.</p>}        </>
      )}
      <p className="hint">
        {minimum.trim()
          ? `Buyers spending ${rupees(parseWhole(minimum) ?? 0)} or more see only this reward when it is the highest one they reach.`
          : 'A buyer never chooses between a discount and a gift.'}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
          {offer ? 'Save offer' : 'Add offer'}
        </button>
      </div>
    </form>
  )
}
=======
          {gifts.length > 0 && <p className="hint">Every selected gift is added to the buyer's order and deducted from stock.</p>}        </>
      )}
      <p className="hint">
        {minimum.trim()
          ? `Buyers spending ${rupees(parseWhole(minimum) ?? 0)} or more see only this reward when it is the highest one they reach.`
          : 'A buyer never chooses between a discount and a gift.'}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
          {offer ? 'Save offer' : 'Add offer'}
        </button>
      </div>
    </form>
  )
}
>>>>>>> 1e93a50f783b841383173e99bc31d39d2d1aeb4b
