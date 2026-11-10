import { rupees } from '../format'
import { findCatalogItem, offerSummary } from '../offers'
import type { Offer, State } from '../types'

export function OfferList({
  state,
  editable = false,
  onEdit,
  onDelete,
}: {
  state: State
  editable?: boolean
  onEdit?: (offer: Offer) => void
  onDelete?: (offer: Offer) => void
}) {
  const offers = [...state.offers].sort((left, right) => left.minimumAmount - right.minimumAmount)
  if (offers.length === 0) {
    return (
      <div className="empty">
        <h3>No offers yet</h3>
        <p>
          {editable
            ? 'Add one reward for a purchase amount. A bill gets either a discount or a gift, whichever offer is highest.'
            : 'The seller has not published an offer yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="offer-list">
      {offers.map((offer) => {
        const gift = findCatalogItem(state, offer.productId, offer.variantId)
        const giftLabel = gift ? `${gift.productName} · ${gift.variantName}` : 'a catalog item'
        return (
          <article key={offer.id} className="offer-card">
            <div>
              <p className="offer-kicker">{offer.reward === 'discount' ? 'Discount' : 'Gift'}</p>
              <h3>{offer.name}</h3>
              <p>{offerSummary(offer, giftLabel)}</p>
              <p className="hint">Unlocks at {rupees(offer.minimumAmount)} on the bill.</p>
            </div>
            {editable && (
              <div className="row-actions">
                <button type="button" className="btn secondary small" onClick={() => onEdit?.(offer)}>
                  Edit
                </button>
                <button type="button" className="btn danger-text small" onClick={() => onDelete?.(offer)}>
                  Delete
                </button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
