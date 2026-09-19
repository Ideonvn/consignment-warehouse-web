import type { Metadata } from "next";
import {
  ContactEmail,
  LegalList,
  LegalPage,
  LegalSection,
  OPERATOR_NAME,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Consignment Warehouse collects, why, who processes it, and how to access, correct or delete your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective="19 September 2026"
      intro="This policy explains what personal information the Consignment Warehouse app and website collect, why we need it, who helps us process it, and how you can see, correct or delete it. It is written to meet the Protection of Personal Information Act, 2013 (POPIA)."
    >
      <LegalSection heading="1. Who we are">
        <p>
          Consignment Warehouse runs online consignment auctions through its mobile app and the
          website at consignment-warehouse.com. The service is operated by {OPERATOR_NAME} (“we”,
          “us”), the responsible party for your personal information under POPIA.
        </p>
        <p>
          For anything in this policy, including requests to see, correct or delete your information,
          email <ContactEmail subject="Privacy request" />. That address also reaches our Information
          Officer.
        </p>
      </LegalSection>

      <LegalSection heading="2. What we collect">
        <p>You can browse public auctions without an account. We collect personal information only when you sign up, bid or contact us.</p>
        <LegalList>
          <li>
            <strong>Account details:</strong> your mobile number (this is how you sign in), and if you
            give them, your first and last name and email address. We also record whether your number
            and email have been verified.
          </li>
          <li>
            <strong>Bids and auction activity:</strong> every bid you place, any maximum you set for
            auto bidding, the time of each bid, and the outcome of the lots you bid on.
          </li>
          <li>
            <strong>Account balance:</strong> your payment reference, deposits and payments recorded
            against your account, lots won, charges, refunds and corrections, and your running
            balance. We do not collect or store card or bank account details. Payments are made to us
            directly, outside the app.
          </li>
          <li>
            <strong>Sign-in and security data:</strong> a device identifier, a device name or browser
            description, your IP address when you ask for a sign-in code, and the times you sign in.
          </li>
          <li>
            <strong>Push notification token:</strong> if you allow notifications in the mobile app, we
            store the token your phone issues so we can send them to that device.
          </li>
          <li>
            <strong>Your preferences:</strong> which marketing messages you have agreed to receive,
            and when you agreed.
          </li>
          <li>
            <strong>Messages with us:</strong> anything you send us by email or another channel.
          </li>
        </LegalList>
        <p>
          We do not collect your location, contacts, photos or files. We do not use advertising or
          analytics trackers, and we do not build advertising profiles.
        </p>
      </LegalSection>

      <LegalSection heading="3. Why we use it">
        <LegalList>
          <li>To create your account and sign you in with a one-time code sent to your phone.</li>
          <li>To place your bids, run auto bidding up to the maximum you set, and decide who won each lot.</li>
          <li>To keep your account balance, show you your statement, and match payments to you by your payment reference.</li>
          <li>To tell you when you have been outbid, when you have won, when a new auction opens, and when a payment has been received.</li>
          <li>To send marketing messages, only on the channels you have agreed to.</li>
          <li>To keep the service secure: to limit repeated sign-in attempts, detect misuse and protect your account.</li>
          <li>To meet our legal, tax and accounting obligations and to resolve disputes.</li>
        </LegalList>
        <p>
          We rely on the contract between us (you cannot bid without an account), our legal
          obligations, our legitimate interest in running a secure and fair auction, and, for
          marketing, your consent.
        </p>
      </LegalSection>

      <LegalSection heading="4. Messages and notifications">
        <p>
          Messages about your bids and your account (outbid, won, payment received, verification
          codes and new auctions opening) are part of the service and are always sent. We send them by push notification, SMS,
          email or WhatsApp, depending on what you have set up. Email is only used once you have
          verified your address.
        </p>
        <p>
          Marketing messages are separate and are only sent with your consent. You can change your
          marketing choice for each channel on your profile at any time. You can turn push
          notifications off in your phone’s settings.
        </p>
      </LegalSection>

      <LegalSection heading="5. Cookies and storage on your device">
        <p>
          The website sets one secure cookie that keeps you signed in. Scripts on the page cannot read
          it. The website and app also store a few small values on your device: a device identifier,
          your light or dark theme choice, and a note of which wins you have already been shown. We do
          not use advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="6. Who we share it with">
        <p>
          We do not sell or rent your personal information. We share it only with the service
          providers who run parts of the service for us. Each receives only what it needs:
        </p>
        <LegalList>
          <li>
            <strong>Amazon Web Services</strong>, which hosts our servers and database in Cape Town,
            South Africa.
          </li>
          <li>
            <strong>SMSPortal</strong>, which sends SMS messages and sign-in codes.
          </li>
          <li>
            <strong>Zoho ZeptoMail</strong>, which sends email.
          </li>
          <li>
            <strong>Meta (WhatsApp)</strong>, which delivers WhatsApp messages.
          </li>
          <li>
            <strong>Expo, Google and Apple</strong>, which deliver push notifications to the mobile
            app.
          </li>
        </LegalList>
        <p>
          Other bidders never see your name, number or email. We may disclose information when the law
          requires it, or when it is needed to protect the rights or safety of our users or the
          service.
        </p>
      </LegalSection>

      <LegalSection heading="7. Information sent outside South Africa">
        <p>
          Your account and bidding records are stored in South Africa. Some of the providers above
          deliver messages from outside South Africa, so your phone number, email address or push
          token, and the content of the message, may be processed in other countries. We use only
          providers bound by data protection obligations at least as strong as POPIA’s, as section 72
          of POPIA requires.
        </p>
      </LegalSection>

      <LegalSection heading="8. How long we keep it">
        <LegalList>
          <li>Sign-in codes and expired sign-in sessions are deleted automatically once they are used or expire.</li>
          <li>
            Bids, lot outcomes and your account statement are financial records. We keep them for at
            least five years, as South African tax and accounting law requires, even after your
            account is closed.
          </li>
          <li>Other account details are kept while your account is open and deleted or anonymised when it is closed, unless the law requires us to keep them.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="9. Deleting your account">
        <p>
          To delete your account and its personal information, email{" "}
          <ContactEmail subject="Delete my account" /> with the subject “Delete my account”, and include
          the mobile number you sign in with. We may confirm the request with you by SMS before we act
          on it. We will act on it within 30 days.
        </p>
        <p>When your account is deleted:</p>
        <LegalList>
          <li>You are signed out on every device and cannot sign in again with that account.</li>
          <li>Your name, email address, push tokens and preferences are deleted.</li>
          <li>
            Your bids and account statement are kept only as the financial records described above.
            Your phone number stays linked to them, and they are not used for anything else.
          </li>
          <li>
            If your account shows an amount due, we keep what we need to settle it. If it shows
            credit, contact us about a refund before the account is deleted.
          </li>
        </LegalList>
        <p>
          A bid you placed on a lot that is still open cannot be withdrawn by deleting your account.
        </p>
      </LegalSection>

      <LegalSection heading="10. Your rights">
        <p>Under POPIA you have the right to:</p>
        <LegalList>
          <li>ask whether we hold personal information about you, and for a copy of it;</li>
          <li>ask us to correct or delete information that is inaccurate, out of date or no longer needed;</li>
          <li>object to how we process your information, and withdraw your consent to marketing at any time; and</li>
          <li>
            complain to the Information Regulator of South Africa (inforegulator.org.za,{" "}
            <a
              className="text-accent-text underline underline-offset-4"
              href="mailto:POPIAComplaints@inforegulator.org.za"
            >
              POPIAComplaints@inforegulator.org.za
            </a>
            ).
          </li>
        </LegalList>
        <p>
          You can update your name, email and marketing preferences on your profile yourself. For
          anything else, email <ContactEmail subject="Privacy request" />.
        </p>
      </LegalSection>

      <LegalSection heading="11. Security">
        <p>
          Your connection to the service is encrypted. Sign-in uses one-time codes, so we never store a
          password. Sign-in sessions are short-lived, are tied to the device, and can be revoked. Access
          to bidder information is limited to the people who run the auctions. If we learn of a breach
          that affects your information, we will tell you and the Information Regulator, as POPIA
          requires.
        </p>
      </LegalSection>

      <LegalSection heading="12. Children">
        <p>
          You must be 18 or older to create an account or bid. We do not knowingly collect personal
          information from anyone under 18. If you believe we have, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="13. Changes to this policy">
        <p>
          If we change this policy, we will update the effective date at the top of this page. If a
          change significantly affects how we use your information, we will tell you in the app or by
          message before it takes effect.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
