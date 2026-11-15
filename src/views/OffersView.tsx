import { useState } from 'react'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { OfferForm } from '../components/OfferForm'
import { OfferList } from '../components/OfferList'
import { useMarket } from '../store'
import type { Offer } from '../types'

export function OffersView({ editable }: { editable: boolean }) {
  const market = useMarket()
  const [editing, setEditing] = useState<Offer | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Offer | null>(null)

  return (
    <section data-testid="view-offers">
      <div className="page-head">
        <div>
          <h2>Offers</h2>
          <p className="lede">
            {editable
              ? 'Set the purchase amount, then choose one reward: a cash discount or gift items. A bill receives only the highest offer it reaches, so the buyer never picks between the two.'
              : 'These rewards are set by the seller. A purchase receives the highest offer it reaches, and that reward is either a discount or a gift.'}
          </p>
        </div>
        {editable && (
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add offer
          </button>
        )}
      </div>
      <OfferList
        state={market.state}
        editable={editable}
        onEdit={setEditing}
        onDelete={setPendingDelete}
      />
      {(creating || editing) && (
        <Dialog
          title={editing ? 'Edit offer' : 'Add offer'}
          subtitle="One reward for this purchase amount."
          wide
          closeOnBackdrop={false}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        >
          <OfferForm
            state={market.state}
            offer={editing ?? undefined}
            onCancel={() => {
              setCreating(false)
              setEditing(null)
            }}
            onSubmit={(input, offerId) => {
              const result = market.saveOffer(input, offerId)
              if (result.ok) {
                setCreating(false)
                setEditing(null)
              }
              return result
            }}
          />
        </Dialog>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${pendingDelete.name}?`}
          body="Past purchases keep the reward they already received. New purchases will no longer use this offer."
          confirmLabel="Remove offer"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            market.removeOffer(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </section>
  )
}
