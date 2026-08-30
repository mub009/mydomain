import LegalPage, { Ph } from "@/components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="[Effective date to be filled in]">
      <p>
        This Privacy Policy explains how <Ph>[Legal entity name]</Ph> ("Markkito", "we", "us", "our") collects,
        uses, shares, and protects information when you use the Markkito platform (the "Platform"). It is drawn
        up with reference to the Information Technology Act, 2000, the Information Technology (Reasonable
        Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the
        Digital Personal Data Protection Act, 2023. By using the Platform, you consent to the practices described
        here.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>a) Information you give us</h3>
      <ul>
        <li>Account details — first and last name, email address and/or phone number, and password.</li>
        <li>
          Business details — for a business listing: business name, category, description, address, phone,
          email, website, hours, services, prices, and photos.
        </li>
        <li>
          Classifieds listing details — title, description, category, condition, price, contact phone and/or
          WhatsApp number, and photos of the item.
        </li>
        <li>Booking, order, and review content you submit.</li>
        <li>Any message or information you submit through a contact, lead, or enquiry form.</li>
      </ul>
      <h3>b) Location information</h3>
      <p>
        With your consent (collected via an on-screen prompt), we capture your approximate or precise location —
        either a city you enter or your device's GPS coordinates — to show nearby businesses and classified
        listings, and to let a business's dashboard show where its customers are visiting from.
      </p>
      <h3>c) Information collected automatically</h3>
      <ul>
        <li>
          Usage and analytics data — pages visited, timestamps, device type, and browser, collected to run the
          Platform's analytics dashboard for administrators (for example, "online now" and "most-visited pages").
        </li>
        <li>
          Your IP address, which we use with a third-party IP-geolocation lookup to show an approximate city for
          analytics purposes.
        </li>
        <li>Standard technical data such as browser type and device identifiers, for security and debugging.</li>
      </ul>
      <h3>d) Cookies and local storage</h3>
      <p>
        We use your browser's local storage to remember things like your saved location, recently viewed items,
        login session, and consent choices. We do not currently use third-party advertising cookies.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account and let you use the Platform's features;</li>
        <li>To show you relevant businesses and classified listings near your chosen or detected location;</li>
        <li>
          To let a customer contact a business or a classifieds seller (your enquiry, phone reveal, or WhatsApp
          click shares the necessary contact details with that business or seller);
        </li>
        <li>To operate bookings, storefront orders, reviews, and the dealer-points system;</li>
        <li>To send you account-related, transactional, or service messages;</li>
        <li>To detect, prevent, and investigate fraud, abuse, or violations of our Terms of Use;</li>
        <li>To produce aggregated, anonymised analytics for administrators and business owners.</li>
      </ul>

      <h2>3. Consent</h2>
      <p>
        Where the Platform asks you to opt in — for example, to share your phone number and location on first
        visit — that feature is used only after you provide consent. You may decline and continue browsing with
        reduced personalisation; declining does not otherwise limit your ability to create an account and use
        the Platform.
      </p>

      <h2>4. Disclosure of Information</h2>
      <p>We share information only in the following circumstances:</p>
      <ul>
        <li>
          <strong>With businesses and other users you interact with</strong> — if you reveal a phone number,
          message a seller, book a service, or place an order, the relevant contact and order details are shared
          with that business or user so the transaction can proceed.
        </li>
        <li>
          <strong>Public listing content</strong> — your business listing, classified listing, and reviews you
          post are publicly visible on the Platform by design.
        </li>
        <li>
          <strong>Service providers</strong> — we use third-party infrastructure to operate the Platform,
          including cloud hosting and object storage for uploaded photos (DigitalOcean) and a third-party
          IP-geolocation lookup service, each of which processes data only as needed to provide that service.
        </li>
        <li>
          <strong>Legal requirements</strong> — where required to comply with a law, regulation, court order, or
          a valid request from a government or law-enforcement authority.
        </li>
        <li>
          <strong>Business transfers</strong> — if Markkito is involved in a merger, acquisition, or asset sale,
          user information may be transferred as part of that transaction, subject to this Policy.
        </li>
      </ul>
      <p>We do not sell your personal information to third parties.</p>

      <h2>5. Cross-Border Data Storage</h2>
      <p>
        Some infrastructure we use, including cloud storage for uploaded photos, may store data outside India.
        Where this is the case, we take reasonable steps to ensure such providers maintain a comparable level of
        data protection.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain account and listing information for as long as your account is active, and for a reasonable
        period after deletion to comply with legal, accounting, or reporting obligations, and to resolve
        disputes. Analytics data may be retained in aggregated or anonymised form for longer periods.
      </p>

      <h2>7. Data Security</h2>
      <p>
        We use reasonable technical and organisational measures — including encrypted connections, hashed
        passwords, and access controls — to protect your information. No method of transmission or storage is
        completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>8. Your Rights</h2>
      <p>Subject to applicable law, you may:</p>
      <ul>
        <li>Access and review the personal information in your account via your profile;</li>
        <li>Request correction of inaccurate information;</li>
        <li>Request deletion of your account and associated personal information;</li>
        <li>Withdraw a consent you previously gave (for example, location sharing), at any time going forward;</li>
        <li>
          Raise a grievance about how your information is handled — see our{" "}
          <a href="/grievance">Grievance Redressal</a> page.
        </li>
      </ul>
      <p>
        To exercise any of these rights, contact us at <Ph>[privacy/support email]</Ph>.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        The Platform is not directed at, and we do not knowingly collect personal information from, individuals
        under 18 years of age. If you believe a minor has provided us information, contact us and we will take
        steps to remove it.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected by updating the
        "Effective date" above, and, where required by law, we will notify you by other reasonable means.
      </p>

      <h2>11. Grievance Officer / Contact</h2>
      <p>
        For any privacy-related question or complaint, contact our Grievance Officer named on the{" "}
        <a href="/grievance">Grievance Redressal</a> page, or write to <Ph>[privacy/support email]</Ph>.
      </p>
    </LegalPage>
  );
}
