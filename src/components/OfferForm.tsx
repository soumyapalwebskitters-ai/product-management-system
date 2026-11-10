import { useMemo, useState, type FormEvent } from 'react'
import type { SearchMode } from '../search'
import { rupees } from '../format'
import { parseWhole } from '../format'
import type { OfferInput } from '../offers'
import type { ActionResult } from '../store'
import type { Offer, State } from '../types'
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
  const [giftId, setGiftId] = useState(offer?.reward === 'gift' ? `${offer.productId}:${offer.variantId}` : null)
  const [quantity, setQuantity] = useState(offer?.reward === 'gift' ? String(offer.quantity) : '1')
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [error, setError] = useState<string | null>(null)

  const options = useMemo<SelectOption[]>(
    () =>
      state.products.flatMap((product) =>
        product.variants.map((variant) => ({
          id: `${product.id}:${variant.id}`,
          title: `${product.name} · ${variant.name}`,
          meta: variant.sku,
          searchText: `${product.name} ${variant.name} ${variant.sku}`,
        })),
      ),
    [state.products],
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    const minimumAmount = parseWhole(minimum)
    const parsedPercent = parseWhole(percent)
    const parsedQuantity = parseWhole(quantity)
    if (!name.trim()) {
      setError('Enter a name for the offer.')
      return
    }
    if (minimumAmount === null || minimumAmount < 1) {
      setError('Enter the purchase amount that unlocks this offer.')
      return
    }
    const [productId = '', variantId = ''] = giftId?.split(':') ?? []
    const result = onSubmit(
      {
        name,
        minimumAmount,
        reward,
        percent: reward === 'discount' ? parsedPercent ?? 0 : 0,
        productId: reward === 'gift' ? productId : '',
        variantId: reward === 'gift' ? variantId : '',
        quantity: reward === 'gift' ? parsedQuantity ?? 0 : 0,
      },
      offer?.id ?? null,
    )
    if (!result.ok) setError(result.error)
  }

  return (
    <form onSubmit={submit}>
      {error && (
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
      <div className="filters" role="group" aria-label="Reward">
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
          <div className="field">
            <span>Gift</span>
            <ProductSelect
              label="Gift item"
              placeholder="Select a gift"
              options={options}
              query={query}
              mode={searchMode}
              selectedId={giftId}
              onQueryChange={setQuery}
              onModeChange={setSearchMode}
              onSelect={setGiftId}
              inline
            />
          </div>
          <label className="field">
            <span>Free quantity</span>
            <input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          {giftId && <p className="hint">The buyer does not pay for these items, and there is no extra cash discount.</p>}
        </>
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
