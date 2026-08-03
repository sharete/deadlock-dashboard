const setupSteps = [
  {
    label: "Projektfundament",
    detail: "Anwendung und Git-Repository angelegt",
    ready: true,
  },
  {
    label: "Steam Web API",
    detail: "STEAM_API_KEY sicher hinterlegen",
    ready: Boolean(process.env.STEAM_API_KEY),
  },
  {
    label: "Spielerprofil",
    detail: "STEAM_ID64 mit deinem Account verbinden",
    ready: Boolean(process.env.STEAM_ID64),
  },
  {
    label: "Deadlock-Matchdaten",
    detail: "Datenquelle prüfen und anbinden",
    ready: Boolean(process.env.DEADLOCK_API_BASE_URL),
  },
];

const modules = [
  {
    index: "01",
    title: "Match Intelligence",
    copy: "Verlauf, Ergebnis, Dauer, Team und die entscheidenden Wendepunkte jedes Matches.",
    metric: "30 / 60 / 100",
    unit: "Matches",
  },
  {
    index: "02",
    title: "Hero Performance",
    copy: "Winrate, KDA, Souls pro Minute und Wirkung im direkten Heldenvergleich.",
    metric: "—",
    unit: "Daten ausstehend",
  },
  {
    index: "03",
    title: "Build Analytics",
    copy: "Items, Timings und Builds mit dem tatsächlichen Match-Ausgang verbinden.",
    metric: "—",
    unit: "Daten ausstehend",
  },
];

export default function Home() {
  const completed = setupSteps.filter((step) => step.ready).length;
  const progress = `${Math.round((completed / setupSteps.length) * 100)}%`;

  return (
    <main className="dashboard-shell">
      <div className="grid-glow" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Deadlock Personal Intelligence Startseite">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span className="brand-copy">
            <strong>DEADLOCK</strong>
            <small>PERSONAL INTELLIGENCE</small>
          </span>
        </a>

        <div className="private-state">
          <span className="pulse" aria-hidden="true" />
          Privater Workspace
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">PERSONAL PERFORMANCE SYSTEM // PHASE 01</p>
          <h1>
            Deine Matches.
            <span>Dein Muster.</span>
          </h1>
          <p className="lead">
            Ein persönliches Deadlock-Dashboard, das aus Matchdaten klare
            Entscheidungen für Helden, Builds und deinen nächsten Schritt macht.
          </p>

          <div className="scope-row" aria-label="Geplanter Analyseumfang">
            <span>Matches</span>
            <span>Helden</span>
            <span>Builds</span>
            <span>Entwicklung</span>
          </div>
        </div>

        <aside className="setup-card" aria-labelledby="setup-title">
          <div className="setup-head">
            <div>
              <p className="card-kicker">SYSTEM STATUS</p>
              <h2 id="setup-title">Datenzugang einrichten</h2>
            </div>
            <span className="status-badge">{completed}/4 bereit</span>
          </div>

          <div className="progress" aria-label={`${progress} der Einrichtung abgeschlossen`}>
            <span style={{ width: progress }} />
          </div>

          <ol className="setup-list">
            {setupSteps.map((step, index) => (
              <li className={step.ready ? "is-ready" : ""} key={step.label}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="step-copy">
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
                <span className="step-state">{step.ready ? "Bereit" : "Offen"}</span>
              </li>
            ))}
          </ol>

          <p className="security-note">
            API-Schlüssel bleiben ausschließlich serverseitig und werden nie im
            Repository gespeichert.
          </p>
        </aside>
      </section>

      <section className="blueprint" aria-labelledby="blueprint-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DASHBOARD BLUEPRINT</p>
            <h2 id="blueprint-title">Gebaut für deine Entscheidungen</h2>
          </div>
          <span className="waiting-state">
            <span aria-hidden="true" /> Wartet auf Datenquelle
          </span>
        </div>

        <div className="module-grid">
          {modules.map((module) => (
            <article className="module-card" key={module.index}>
              <div className="module-topline">
                <span>{module.index}</span>
                <span className="module-signal" aria-hidden="true" />
              </div>
              <h3>{module.title}</h3>
              <p>{module.copy}</p>
              <div className="module-metric">
                <strong>{module.metric}</strong>
                <span>{module.unit}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>DEADLOCK PERSONAL INTELLIGENCE</span>
        <span>Foundation build · No credentials committed</span>
      </footer>
    </main>
  );
}
