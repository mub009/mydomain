import LegalPage, { Ph } from "@/components/LegalPage";

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund & Cancellation Policy" effectiveDate="[Effective date to be filled in]">
      <p>
        This policy explains how cancellations and refunds work for the two kinds of transactions Markkito
        facilitates: storefront orders placed with a business, and classifieds purchases between individual
        buyers and sellers. Read it together with our <a href="/terms">Terms of Use</a>.
      </p>

      <h2>1. Markkito Does Not Process Payments</h2>
      <p>
        Markkito does not currently collect payment for storefront orders or classifieds items on behalf of a
        business or seller. Storefront checkout on the Platform is <strong>Cash on Delivery only</strong> — you
        pay the business directly when the order is delivered. Classifieds transactions are agreed and paid for
        directly between the buyer and seller, outside the Platform. Because Markkito never holds your money, it
        cannot itself issue a refund — refunds are the responsibility of the business or seller you transacted
        with.
      </p>

      <h2>2. Storefront Orders (Cash on Delivery)</h2>
      <h3>Cancellation</h3>
      <p>
        You may cancel a storefront order by contacting the business directly using the contact details on its
        listing, ideally before it has been dispatched. Individual businesses may set their own cancellation
        window; check with the business if unsure.
      </p>
      <h3>Refunds</h3>
      <p>
        Since payment is made on delivery, there is typically nothing to refund for a cancelled order. If an item
        was paid for and later needs to be returned (for example, it arrived damaged or not as described), the
        return and refund is between you and the business, on that business's own return policy. Markkito
        encourages every business to state its return/refund terms clearly on its storefront, but is not a party
        to that policy and does not guarantee, hold, or process any refund.
      </p>

      <h2>3. Classifieds Purchases</h2>
      <p>
        Classifieds items are sold directly between a buyer and a seller, "as described" by the seller. Markkito
        strongly recommends inspecting an item in person before paying. Because Markkito is not a party to the
        sale, it has no obligation to and cannot process a refund for a classifieds purchase. If an item was
        misrepresented or a seller has acted fraudulently, you may report the listing or the user from the
        listing page, or contact us at <Ph>[support email]</Ph> — we may remove the listing or suspend the
        account, but any refund must be pursued directly with the seller, including through applicable consumer
        remedies where the seller is a business.
      </p>

      <h2>4. Bookings</h2>
      <p>
        A booking made through the Platform may be cancelled by the customer through their account, subject to
        the transition rules the business has set for that booking's status. Any charge for a missed or
        late-cancelled appointment, if the business applies one, is set and collected by that business directly,
        not by Markkito.
      </p>

      <h2>5. Disputes</h2>
      <p>
        If you're unable to resolve a payment or refund issue directly with a business or seller, you may raise
        it with our Grievance Officer — see <a href="/grievance">Grievance Redressal</a> — and, where the other
        party is a registered business on the Platform, we will make reasonable efforts to put you in touch with
        them and may take action against a listing or account found to be acting in bad faith.
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        This policy will be updated if Markkito begins collecting payments directly (for example, if online
        payment is added to storefront checkout in future), at which point this page will set out the applicable
        refund timelines and process.
      </p>
    </LegalPage>
  );
}
