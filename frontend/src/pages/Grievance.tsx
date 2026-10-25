import LegalPage, { Ph } from "@/components/LegalPage";

export default function Grievance() {
  return (
    <LegalPage title="Grievance Redressal" effectiveDate="[Effective date to be filled in]">
      <p>
        In accordance with the Information Technology Act, 2000 and the Information Technology (Intermediary
        Guidelines and Digital Media Ethics Code) Rules, 2021, and the Consumer Protection (E-Commerce) Rules,
        2020, the name and contact details of the Grievance Officer for Markkito are published below.
      </p>

      <h2>Grievance Officer</h2>
      <ul>
        <li>
          <strong>Name:</strong> <Ph>[Grievance Officer's full name]</Ph>
        </li>
        <li>
          <strong>Designation:</strong> <Ph>[Designation]</Ph>
        </li>
        <li>
          <strong>Entity:</strong> <Ph>[Legal entity name]</Ph>
        </li>
        <li>
          <strong>Address:</strong> <Ph>[Registered office / correspondence address]</Ph>
        </li>
        <li>
          <strong>Email:</strong> <Ph>[grievance officer email]</Ph>
        </li>
        <li>
          <strong>Phone:</strong> <Ph>[grievance officer phone, with hours e.g. Mon–Fri, 10am–6pm IST]</Ph>
        </li>
      </ul>

      <h2>What You Can Raise Here</h2>
      <ul>
        <li>A complaint about content on the Platform — a listing, review, or classified item;</li>
        <li>A complaint about how your personal information has been handled;</li>
        <li>A dispute you were unable to resolve directly with a business or another user;</li>
        <li>Any other grievance relating to the Platform's operation or these policies.</li>
      </ul>

      <h2>How to Raise a Complaint</h2>
      <p>
        Write to the Grievance Officer at the email or address above, including your name, contact details, the
        listing or order in question (if any), and a description of the issue. You may also use the "Report"
        option on a listing page where available.
      </p>

      <h2>Resolution Timeline</h2>
      <p>
        We will acknowledge a complaint within <Ph>[e.g. 48 hours]</Ph> of receipt and aim to resolve it within{" "}
        <Ph>[e.g. 30 days]</Ph>, in line with applicable timelines under Indian law. Complex matters may take
        longer; we will keep you informed of progress.
      </p>

      <h2>Consumer Protection (E-Commerce) Rules, 2020 — Entity Details</h2>
      <p>The following details are published as required for e-commerce entities under Indian law:</p>
      <ul>
        <li>
          <strong>Legal name:</strong> <Ph>[Legal entity name]</Ph>
        </li>
        <li>
          <strong>Principal place of business:</strong> <Ph>[Registered/head office address]</Ph>
        </li>
        <li>
          <strong>GSTIN:</strong> <Ph>[GSTIN, if applicable]</Ph>
        </li>
        <li>
          <strong>CIN:</strong> <Ph>[Corporate Identification Number, if applicable]</Ph>
        </li>
        <li>
          <strong>Customer support contact:</strong> <Ph>[support email/phone]</Ph>
        </li>
      </ul>
    </LegalPage>
  );
}
