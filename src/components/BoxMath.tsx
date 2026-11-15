import { boxesLabel, itemsLabel } from '../format'
import type { PurchaseCalc } from '../purchase'

export function BoxMath({ calc }: { calc: PurchaseCalc }) {
  return (
    <div className="box-math-block">
      <dl className="box-math">
        <div>
          <dt>Required quantity</dt>
          <dd data-testid="required-qty">{itemsLabel(calc.purchaseQty)}</dd>
        </div>
        <div>
          <dt>Boxes to purchase</dt>
          <dd data-testid="boxes">{boxesLabel(calc.boxes)}</dd>
        </div>
        <div>
          <dt>Total items purchased</dt>
          <dd data-testid="total-items">{calc.totalItems.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Extra items</dt>
          <dd data-testid="extra-items">{calc.extra.toLocaleString()}</dd>
        </div>
      </dl>
      <p className="hint">
        {calc.itemsPerBox.toLocaleString()} per box, rounded up to a full box.
      </p>
    </div>
  )
}
