import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactEmail,
  LegalList,
  LegalPage,
  LegalSection,
  OPERATOR_NAME,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using Consignment Warehouse: accounts, how bidding and auto bidding work, winning, paying and collecting.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      effective="19 September 2026"
      intro="These terms apply when you use the Consignment Warehouse app or website. They explain what a bid commits you to, how auctions close, and what happens when you win. By creating an account or placing a bid, you agree to them."
    >
      <LegalSection heading="1. About these terms">
        <p>
          Consignment Warehouse is operated by {OPERATOR_NAME} (“we”, “us”). We run online auctions of
          goods that are consigned to us for sale. Each auction may also have its own rules, such as a
          deposit or a buyer’s premium. You can see them by tapping ⓘ on the auction. Those rules
          apply alongside these terms. If they conflict, the auction’s rules apply to that auction.
        </p>
        <p>
          Our <Link className="text-accent-text underline underline-offset-4" href="/privacy-policy">Privacy Policy</Link>{" "}
          explains how we handle your personal information.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <LegalList>
          <li>You must be 18 or older, and able to enter into a binding agreement, to create an account or bid.</li>
          <li>You sign in with a code sent to your mobile number. Keep your phone secure: anyone who can receive your codes can bid as you, and you are responsible for bids placed from your account.</li>
          <li>Keep one account per person, and keep your details up to date so that you receive messages about your bids.</li>
          <li>Tell us straight away if you think someone else has used your account.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="3. Browsing">
        <p>
          Anyone can view public auctions, lots and prices without an account or a deposit. Photos and
          descriptions are provided to help you judge each lot. Look at them carefully, and ask us
          before you bid if anything is unclear.
        </p>
      </LegalSection>

      <LegalSection heading="4. Placing a bid">
        <p>
          <strong>A bid is placed the moment you press the bid button, and it is binding.</strong>{" "}
          There is no confirmation step and no way to withdraw a bid. The button shows the exact amount
          you are bidding before you press it. If you win, you must pay that amount.
        </p>
        <LegalList>
          <li>The minimum next bid is set by us for each auction and lot, and it is shown on the button. You cannot bid less.</li>
          <li>We may refuse a bid, for example because the lot has closed, someone bid first, you have not paid the auction’s deposit, or you are bidding too often.</li>
          <li>
            In exceptional cases, such as a clear technical fault, we may cancel (void) a bid. This is
            at our discretion. A mistaken tap is not, on its own, grounds to cancel a bid.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="5. Auto bidding">
        <p>
          Instead of bidding the minimum, you can set the most you are willing to pay for a lot. We
          then bid for you, only as much as it takes to keep you in the lead, up to that maximum. You
          pay only what it takes to win. That may be less than your maximum, but it will never be more.
        </p>
        <LegalList>
          <li>Setting a maximum is a binding bid for any amount up to it.</li>
          <li>You can raise your maximum, but you cannot lower or remove it.</li>
          <li>If another bidder has set a higher maximum, their auto bid may outbid you straight away. That is how auto bidding works; it is not an error.</li>
          <li>Other bidders cannot see your maximum, and you cannot see theirs.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="6. How a lot closes">
        <LegalList>
          <li>Each lot has its own closing time, shown in the app. Our server’s clock decides when a lot closes, not your device’s clock.</li>
          <li>
            If a bid is placed shortly before a lot closes, that lot’s closing time is extended. This
            gives other bidders a fair chance to respond. The auction’s rules say how close to the end
            this applies, how long each extension is, and how many there can be.
          </li>
          <li>We may change a lot’s closing time, earlier or later, if it is necessary. The app will show the new time.</li>
          <li>We may withdraw a lot, or cancel an auction, before it closes. Bids on a withdrawn or cancelled lot do not create a sale.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="7. Winning a lot">
        <p>
          When a lot closes, the highest bid wins, as long as any reserve has been met. At that point
          you have a binding agreement to buy the lot for your winning bid, plus any buyer’s premium
          or other charges stated in the auction’s rules.
        </p>
        <LegalList>
          <li>
            Some lots have a reserve, a minimum price the seller will accept. The app shows whether a
            reserve has been met, but not the amount. If the reserve is not met, the lot does not sell.
            The seller may still accept the highest bid after the lot closes. If they do, that bid wins
            and we will tell you.
          </li>
          <li>We will tell you when you win by notification and in the app.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="8. Deposits, your balance and paying">
        <LegalList>
          <li>
            You have one running balance with us. Deposits and payments add credit. Lots you win, and
            any buyer’s premium, are charged against it. A negative balance is an amount you owe us.
          </li>
          <li>
            Some auctions require credit on your account, a deposit, before you can bid. Browsing never
            requires a deposit.
          </li>
          <li>
            Pay using the payment instructions and your payment reference, shown on your account
            screen. You must pay what you owe within the time set out in the auction’s rules or in our
            payment instructions.
          </li>
          <li>Credit left on your account carries over to future auctions. Contact us if you would like a refund of unused credit.</li>
          <li>
            If you do not pay, we may cancel the sale, re-offer the lot, keep any deposit to cover our
            losses, suspend your account, and recover the amount owed.
          </li>
          <li>Your account statement shows every entry. Corrections appear as separate entries, and none are removed.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="9. Collection">
        <p>
          Lots are collected from us once they have been paid for, using the collection details
          provided for the auction. Please collect promptly. We may charge for storage, or treat the
          sale as cancelled, if a lot is not collected within the time set out in the auction’s rules.
        </p>
      </LegalSection>

      <LegalSection heading="10. Your consumer rights">
        <p>
          Nothing in these terms limits your rights under the Consumer Protection Act, 2008, or any
          other law that cannot be excluded by agreement. Under section 42 of the Electronic
          Communications and Transactions Act, 2002, the cooling-off period for online purchases does
          not apply to goods bought at auction.
        </p>
      </LegalSection>

      <LegalSection heading="11. Fair bidding">
        <p>You must not:</p>
        <LegalList>
          <li>bid on lots you have consigned, or bid for a seller to push a price up;</li>
          <li>use more than one account, or someone else’s account;</li>
          <li>bid with no intention of paying;</li>
          <li>use scripts, bots or other automated tools to bid or to access the service; or</li>
          <li>interfere with the service, or try to get around its limits or security.</li>
        </LegalList>
        <p>
          If we reasonably believe you have broken these terms, we may cancel your bids, suspend or
          close your account, and cancel any sale affected.
        </p>
      </LegalSection>

      <LegalSection heading="12. Service availability">
        <p>
          We work to keep the service running, but connections, notifications and live updates can be
          delayed or interrupted. A lot’s closing time is not extended because your connection dropped
          or a notification arrived late. If you want to win a lot, set a maximum with auto bidding
          rather than relying on bidding in the final seconds.
        </p>
      </LegalSection>

      <LegalSection heading="13. Our liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential loss, or for
          losses caused by interruptions to the service, including a missed bid or a missed
          notification. Our total liability to you about a lot is limited to the amount you paid for
          that lot. This does not limit any liability that cannot lawfully be limited.
        </p>
      </LegalSection>

      <LegalSection heading="14. Changes and ending your account">
        <p>
          We may update these terms. The effective date at the top of this page will change when we
          do. Changes do not apply to bids you placed before they took effect. You can close your
          account at any time, as described in our Privacy Policy. Closing your account does not cancel
          bids you have already placed or amounts you already owe.
        </p>
      </LegalSection>

      <LegalSection heading="15. Law and contact">
        <p>
          These terms are governed by the laws of the Republic of South Africa. For questions,
          complaints or support, email <ContactEmail />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
