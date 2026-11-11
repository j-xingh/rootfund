import React from 'react';

export default function HowItWorks() {
  return (
    <div className="page-narrow">
      <h1>How Rootfund works</h1>
      <p className="lead">A community fund where many small gifts count for more than one big one, and fake accounts can't game it.</p>

      <section className="card">
        <h2>1. You give, the pool tops up</h2>
        <p>Anyone can give $1 to $100 to a local project. A sponsor funds a shared matching pool. At the end of the round the pool is split between projects with a rule called <b>quadratic funding</b>.</p>
      </section>

      <section className="card">
        <h2>2. The rule favors many small donors</h2>
        <p>Compare two projects that each raised $10:</p>
        <table>
          <thead><tr><th>Project</th><th>Who gave</th><th>Share of the pool</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>10 people gave $1 each</td><td className="good-text">Large top-up</td></tr>
            <tr><td>B</td><td>1 person gave $10</td><td className="bad-text">No top-up</td></tr>
          </tbody>
        </table>
        <p className="muted">Broad support signals what a community really wants. One wealthy donor can't steer the pool.</p>
      </section>

      <section className="card">
        <h2>3. The catch: fake donors</h2>
        <p>The same rule is easy to cheat. Someone could create hundreds of fake accounts that each give $1 to their own project, and capture most of the pool.</p>
      </section>

      <section className="card">
        <h2>4. What Rootfund does about it</h2>
        <ul>
          <li><b>AI screening.</b> A trained model scores every donor on 10 behavior signals (timing bursts, email patterns, overlap with other donors, donation sizes).</li>
          <li><b>A simple burst rule</b> as a second opinion.</li>
          <li><b>Flagged donors are left out</b> of the match, with a plain-language reason for each.</li>
          <li><b>A cap</b> stops any one project from taking too much of the pool.</li>
          <li><b>A human approves</b> before any money is paid out. Payouts go through PayPal; flagged real donations can be refunded.</li>
        </ul>
        <p className="muted">Honest limit: the detector was tested on simulated attacks. It is weak against attack styles it has never seen, which is why the cap and human approval exist.</p>
      </section>

      <section className="card">
        <h2>Built on PayPal</h2>
        <p>Donations use PayPal checkout. Status updates arrive by PayPal webhooks. Matched funds are sent with PayPal Payouts. Refunds use PayPal refunds. This build runs on the PayPal sandbox, so all payments are test payments.</p>
      </section>
    </div>
  );
}
