import type { Metadata } from "next";
import LegalPage, { Ph } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" effectiveDate="[Effective date to be filled in]">
      <p>
        These Terms of Use (&quot;Terms&quot;) govern access to and use of the Markkito platform, including the
        website, mobile-optimised web app, and any related services (collectively, the &quot;Platform&quot;),
        operated by <Ph>[Legal entity name, e.g. XYZ Technologies Private Limited]</Ph>, a company incorporated
        under the Companies Act, 2013, having its registered office at <Ph>[Registered office address]</Ph> (
        &quot;Markkito&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By accessing or using the
        Platform, you agree to be bound by these Terms, our <a href="/privacy">Privacy Policy</a>, and any other
        policies referenced herein. If you do not agree, you must not use the Platform.
      </p>

      <h2>1. What Markkito Is</h2>
      <p>
        Markkito is an online local-business directory and classifieds marketplace. It lets businesses create
        listings, accept bookings, run a storefront, and receive customer reviews, and lets individuals post
        classified listings to sell new or used items to other local users. Markkito is a technology platform
        that connects users to each other — it is <strong>not</strong> a party to any transaction, agreement, or
        dispute between a business and a customer, or between a buyer and a seller in the classifieds section,
        except where these Terms say otherwise.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and capable of entering into a legally binding contract under the
        Indian Contract Act, 1872 to create an account or post a listing. By using the Platform, you represent
        that you meet this requirement.
      </p>

      <h2>3. Account Registration</h2>
      <p>
        You may be asked to register using a mobile number, email address, or both, along with a password. You
        are responsible for maintaining the confidentiality of your login credentials and for all activity under
        your account. Notify us immediately at <Ph>[support email/phone]</Ph> if you suspect unauthorised use of
        your account.
      </p>
      <p>The Platform recognises the following account types, each with different capabilities:</p>
      <ul>
        <li>
          <strong>Customer</strong> — browses listings, books services, places storefront orders, posts and
          manages classified listings, leaves reviews, and saves favourites.
        </li>
        <li>
          <strong>Business Owner</strong> — manages one or more business listings, including hours, services,
          products, bookings, orders, and reviews for that business.
        </li>
        <li>
          <strong>Dealer</strong> — an authorised Markkito partner who may create listings on behalf of business
          owners and manage a limited set of features for accounts they created.
        </li>
      </ul>

      <h2>4. Business Listings</h2>
      <p>
        A Business Owner or Dealer creating a listing warrants that all information provided (name, address,
        contact details, category, hours, photos, pricing, and descriptions) is accurate, current, and does not
        infringe any third party&apos;s rights. Markkito does not verify every listing before publication and
        does not guarantee the accuracy, quality, or legality of any business, product, or service listed. A
        &quot;Verified&quot; badge, where shown, reflects that a listing has passed a specific check described
        at the time it is awarded — it is not a general guarantee of the business&apos;s conduct.
      </p>

      <h2>5. Classifieds Marketplace</h2>
      <p>
        The classifieds section lets any registered user post an item for sale and lets any user browse, save,
        and contact a seller. In relation to classified listings:
      </p>
      <ul>
        <li>
          Markkito does not own, inspect, warehouse, ship, or take title to any item listed, and is not a party
          to the sale — the contract of sale is directly between the buyer and the seller.
        </li>
        <li>
          Sellers are solely responsible for the accuracy of a listing&apos;s description, condition, price, and
          photos, and for the item being lawful to sell, genuine, and as described.
        </li>
        <li>
          Buyers are responsible for inspecting an item and satisfying themselves before completing a purchase.
          Markkito recommends meeting in a safe, public location and inspecting an item before paying.
        </li>
        <li>
          The following, without limitation, may not be listed: stolen goods; counterfeit or pirated goods;
          weapons, ammunition, or explosives; narcotics or controlled substances; live animals where prohibited
          by law; prescription medicines; hazardous or regulated chemicals; and any item whose sale is restricted
          or prohibited under Indian law.
        </li>
        <li>
          Markkito may remove a classified listing, or suspend the account that posted it, at its discretion —
          including on a credible report of a prohibited or fraudulent listing — without prior notice.
        </li>
        <li>
          Payment and delivery for a classifieds transaction are arranged directly between buyer and seller;
          Markkito is not involved in and does not guarantee any payment made or item delivered.
        </li>
      </ul>

      <h2>6. Bookings, Storefront Orders &amp; Payments</h2>
      <p>
        Where a business accepts bookings or runs a storefront through the Platform, any resulting appointment
        or order is a contract between the customer and that business. See our{" "}
        <a href="/refund-policy">Refund &amp; Cancellation Policy</a> and{" "}
        <a href="/shipping-policy">Shipping &amp; Delivery Policy</a> for how orders, cancellations, and delivery
        are currently handled on the Platform.
      </p>

      <h2>7. Reviews</h2>
      <p>
        Reviews must reflect a genuine experience with the business being reviewed. Fake, incentivised, or
        defamatory reviews are prohibited and may be removed. A business may publicly reply to a review left on
        its listing but may not have a review removed solely for being negative.
      </p>

      <h2>8. Dealer Points</h2>
      <p>
        Where Markkito operates a points system for Dealers to publish listings on behalf of businesses, points
        are allocated at Markkito&apos;s discretion and have no cash value, are non-transferable, and are not
        redeemable for money except where Markkito expressly states otherwise in writing.
      </p>

      <h2>9. Prohibited Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Post false, misleading, defamatory, obscene, or unlawful content;</li>
        <li>Impersonate any person or entity, or misrepresent your affiliation with one;</li>
        <li>Scrape, harvest, or reverse-engineer any part of the Platform without written permission;</li>
        <li>Upload malicious code or interfere with the Platform&apos;s normal operation;</li>
        <li>Use the Platform to send unsolicited commercial messages;</li>
        <li>Violate any applicable law, including the Information Technology Act, 2000 and rules made under it.</li>
      </ul>

      <h2>10. Intellectual Property</h2>
      <p>
        The Markkito name, logo, and the Platform&apos;s software, design, and underlying code are the property
        of <Ph>[Legal entity name]</Ph> or its licensors. Content you upload (business details, photos,
        listings, reviews) remains yours, but by posting it you grant Markkito a non-exclusive, royalty-free,
        worldwide licence to host, display, and distribute it as part of operating the Platform.
      </p>

      <h2>11. Third-Party Services</h2>
      <p>
        The Platform links to or integrates third-party services (for example, WhatsApp for buyer-seller
        contact, and map or location services). Markkito is not responsible for the content, policies, or
        practices of any third-party service.
      </p>

      <h2>12. Disclaimer of Warranties</h2>
      <p>
        The Platform is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind,
        whether express or implied, including merchantability, fitness for a particular purpose, and
        non-infringement. Markkito does not warrant that the Platform will be uninterrupted, error-free, or
        secure, or that any listing, review, or item description is accurate.
      </p>

      <h2>13. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Markkito and its officers, employees, and agents will not be
        liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of
        profits, data, or goodwill, arising from your use of the Platform, any transaction with a business or
        another user, or any listing&apos;s content — even if advised of the possibility of such damages.
      </p>

      <h2>14. Indemnification</h2>
      <p>
        You agree to indemnify and hold Markkito harmless from any claim, loss, or demand, including reasonable
        legal fees, arising from your use of the Platform, your content, your violation of these Terms, or your
        violation of any right of a third party.
      </p>

      <h2>15. Suspension &amp; Termination</h2>
      <p>
        Markkito may suspend or terminate your account, or remove a listing, at any time for a violation of
        these Terms, suspected fraud, or at its reasonable discretion to protect the Platform and its users. You
        may stop using the Platform and request account deletion at any time by contacting{" "}
        <Ph>[support email]</Ph>.
      </p>

      <h2>16. Grievance Redressal</h2>
      <p>
        In accordance with the Information Technology Act, 2000 and rules made thereunder, and the Consumer
        Protection (E-Commerce) Rules, 2020, grievances relating to the Platform may be raised with our
        Grievance Officer — see the <a href="/grievance">Grievance Redressal</a> page for contact details and
        resolution timelines.
      </p>

      <h2>17. Governing Law &amp; Jurisdiction</h2>
      <p>
        These Terms are governed by the laws of India. Subject to any mandatory consumer-protection venue rules,
        the courts at <Ph>[City, State — e.g. Malappuram, Kerala]</Ph> shall have exclusive jurisdiction over
        any dispute arising out of or relating to these Terms or the Platform.
      </p>

      <h2>18. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be indicated by updating the
        &quot;Effective date&quot; above. Continued use of the Platform after a change takes effect constitutes
        acceptance of the revised Terms.
      </p>

      <h2>19. Contact Us</h2>
      <p>
        Questions about these Terms can be sent to <Ph>[support email]</Ph> or <Ph>[support phone number]</Ph>.
      </p>
    </LegalPage>
  );
}
