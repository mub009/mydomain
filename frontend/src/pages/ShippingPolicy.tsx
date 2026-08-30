import LegalPage, { Ph } from "@/components/LegalPage";

export default function ShippingPolicy() {
  return (
    <LegalPage title="Shipping & Delivery Policy" effectiveDate="[Effective date to be filled in]">
      <p>
        Markkito is a directory and marketplace platform — it does not warehouse, pack, ship, or deliver any
        product itself. Delivery for a storefront order or a classifieds item is arranged directly by the
        business or seller you are transacting with.
      </p>

      <h2>1. Storefront Orders</h2>
      <ul>
        <li>
          Delivery area, delivery charges, and estimated delivery time are set by each individual business and
          may be shown at checkout on that business's storefront.
        </li>
        <li>
          Orders are fulfilled directly by the business — Markkito has no visibility into and does not guarantee
          courier selection, packaging, or delivery timelines.
        </li>
        <li>
          For a delay, damaged shipment, or missing item, contact the business directly using the phone number
          or contact details on its listing or your order confirmation.
        </li>
      </ul>

      <h2>2. Classifieds Items</h2>
      <p>
        Classifieds listings are intended primarily for local, in-person pickup — the buyer and seller agree
        directly on how (and whether) an item is handed over or shipped. Markkito does not arrange, insure, or
        take responsibility for the shipment of a classifieds item between buyer and seller.
      </p>

      <h2>3. If a Business Doesn't Deliver as Promised</h2>
      <p>
        If a business repeatedly fails to deliver as described, you may report the listing from its page, or
        contact us at <Ph>[support email]</Ph>. Markkito may investigate and take action against a listing
        found to be misleading customers about delivery, including suspension, but cannot itself arrange
        delivery or compensate for a missed shipment.
      </p>

      <h2>4. Changes to This Policy</h2>
      <p>
        This policy will be updated if Markkito introduces its own logistics or fulfilment service in future.
      </p>
    </LegalPage>
  );
}
