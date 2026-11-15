import { rupees } from '../format'
import { findCatalogItem, offerSummary } from '../offers'
import type { Offer, State } from '../types'
import { Icon } from './Icon'

export function OfferList({ state, editable = false, onEdit, onDelete }: {
  state: State
  editable?: boolean
  onEdit?: (offer: Offer) => void
  onDelete?: (offer: Offer) => void
}) {
  const offers = [...state.offers].sort((left, right) => left.minimumAmount - right.minimumAmount)
  if (offers.length === 0) {
    return <div className="empty"><h3>No offers yet</h3><p>{editable ? 'Add a reward for a purchase amount. A bill gets only the highest offer it reaches.' : 'The seller has not published an offer yet.'}</p></div>
  }

  return <div className="offer-list">{offers.map((offer) => {
    const configured = offer.giftItems?.length ? offer.giftItems : [{ productId: offer.productId, variantId: offer.variantId, quantity: offer.quantity, quantityUnit: offer.quantityUnit }]
    const gifts = configured.map((gift) => {
      const item = findCatalogItem(state, gift.productId, gift.variantId)
      const variant = state.products.find((product) => product.id === gift.productId)?.variants.find((candidate) => candidate.id === gift.variantId)
      const pieces = gift.quantity * ((gift.quantityUnit ?? 'item') === 'box' ? item?.itemsPerBox ?? 1 : 1)
      return { gift, item, variant, pieces }
    })
    const first = gifts[0]?.item
    const giftLabel = first ? `${first.productName} · ${first.variantName}` : 'a catalog item'
    const retailWorth = gifts.reduce((total, gift) => total + (gift.item?.price ?? 0) * gift.pieces, 0)
    const purchaseCost = gifts.reduce((total, gift) => total + (gift.variant?.buyingPrice ?? 0) * gift.pieces, 0)
    return <article key={offer.id} className="offer-card">
      <div>
        <p className="offer-kicker">{offer.reward === 'discount' ? 'Discount' : 'Gift'}</p>
        <h3>{offer.name}</h3>
        <p>{offerSummary(offer, giftLabel)}</p>
        {offer.reward === 'gift' && gifts.length > 1 && <ul className="hint">{gifts.map(({ gift, item }) => <li key={`${gift.productId}:${gift.variantId}`}>{gift.quantity} {gift.quantityUnit === 'box' ? gift.quantity === 1 ? 'box' : 'boxes' : gift.quantity === 1 ? 'piece' : 'pieces'} of {item ? `${item.productName} · ${item.variantName}` : 'a catalog item'}</li>)}</ul>}
        <p className="hint">Unlocks at {rupees(offer.minimumAmount)} on the bill.</p>
        {!editable && offer.reward === 'gift' && <p className="hint">Worth {rupees(retailWorth)}</p>}
        {editable && offer.reward === 'gift' && <p className="hint">Seller only: cost {rupees(purchaseCost)} · retail {rupees(retailWorth)}</p>}
      </div>
      {editable && <div className="row-actions">
        <button type="button" className="btn secondary small icon-action" aria-label={`Edit ${offer.name}`} title="Edit offer" onClick={() => onEdit?.(offer)}><Icon name="edit" /></button>
        <button type="button" className="btn danger-text small icon-action" aria-label={`Delete ${offer.name}`} title="Delete offer" onClick={() => onDelete?.(offer)}><Icon name="trash" /></button>
      </div>}
    </article>
  })}</div>
}
