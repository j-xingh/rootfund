import React from 'react';

export default function HowItWorks() {
  return (
    <div>
      <section className="band dark tight">
        <div className="wrap">
          <h1 className="display">How Rootfund works</h1>
          <p className="lead">A community fund where many small gifts count for more than one big one, and fake accounts cannot game it.</p>
        </div>
      </section>

      <section className="band light">
        <div className="wrap page-narrow">
          <h2 className="display-m">1. You give. The pool tops up.</h2>
          <p>Anyone can give $1 to $100 to a local project through PayPal. A sponsor funds a shared matching pool. At the end of the round the pool is split between projects using <b>quadratic funding</b>.</p>

          <h2 className="display-m" style={{ marginTop: 40 }}>2. The rule rewards many small supporters.</h2>
          <p>Two projects each raise the same $10:</p>
          <div className="explainer">
            <div className="ex-box">
              <h3>Project A</h3>
              <p>10 people give $1 each</p>
              <div className="dots" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div>
              <p className="small">Match weight: (10 × √1)² − 10 = <b className="num">90</b></p>
            </div>
            <div className="ex-box">
              <h3>Project B</h3>
              <p>1 person gives $10</p>
              <div className="dots" aria-hidden="true"><i className="big" /></div>
              <p className="small">Match weight: (√10)² − 10 = <b className="num">0</b></p>
            </div>
          </div>
          <p>Match weight is the quadratic funding formula before the pool is shared out. Broad support signals what a community really wants, and one large donor cannot steer the pool. Matches shown on the site are <b>estimates</b>: they change as others give and are final only when the round closes.</p>
        </div>
      </section>

      <section className="band green">
        <div className="wrap page-narrow">
          <h2 className="display-m">3. The catch: fake accounts.</h2>
          <p className="lead">The same rule is easy to cheat. Someone could create hundreds of fake accounts that each give a small amount to their own project, and capture much of the pool.</p>
        </div>
      </section>

      <section className="band light">
        <div className="wrap page-narrow">
          <h2 className="display-m">4. What Rootfund does about it.</h2>
          <ul>
            <li><b>AI screening.</b> A trained model scores every donor on 10 behaviour signals: timing bursts, email patterns, overlap with other donors, and donation sizes.</li>
            <li><b>A simple burst rule</b> as a second opinion.</li>
            <li><b>Suspicious donors are excluded</b> from the match, each with a plain-language reason.</li>
            <li><b>A cap</b> stops any one project taking too much of the pool.</li>
            <li><b>A person approves</b> before any money is paid out. Payouts go through PayPal, and flagged real donations can be refunded.</li>
          </ul>
          <p className="muted"><b>Honest limit:</b> the detector was tested on simulated attacks. It is weak against attack styles it has never seen, which is why the cap and the human approval exist.</p>
        </div>
      </section>

      <section className="band dark tight">
        <div className="wrap page-narrow">
          <h2 className="display-m">Built on PayPal</h2>
          <p>Donations use PayPal checkout. Status updates arrive by PayPal webhooks. Matched funds are sent with PayPal Payouts, and refunds use PayPal refunds. This build runs on the PayPal sandbox, so all payments are test payments.</p>
          <a className="btn btn-primary" href="#/">Fund a project</a>
        </div>
      </section>
    </div>
  );
}
