import HeroLink from '../transition/HeroLink'

// Any unknown URL lands here (GitHub Pages serves 404.html = the app, so deep links and typos both work).
export default function NotFound() {
  return (
    <section className="section not-found" data-section="notfound">
      <div className="section-inner" style={{ textAlign: 'center' }}>
        <p className="phase-tag" style={{ justifyContent: 'center' }}>
          Error 404 · <span className="n">Lost in the multiverse</span>
        </p>
        <h1 className="statement" style={{ marginTop: '0.4em' }}>
          This timeline <span className="hl">doesn&apos;t exist.</span>
        </h1>
        <p className="section-lede" style={{ margin: '1.4rem auto 2.2rem' }}>
          The page you were looking for was never built. Head back to base and pick a hero.
        </p>
        <HeroLink to="home" className="btn btn-primary" data-cursor="HOME">
          Return to base →
        </HeroLink>
      </div>
    </section>
  )
}
