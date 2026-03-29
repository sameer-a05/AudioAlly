import { Link } from 'react-router-dom'
import MascotCharacter from './MascotCharacter'

export default function Navigation() {
  return (
    <header className="aa-nav" role="banner">
      <div className="aa-nav-inner">
        <Link to="/" className="aa-nav-brand" aria-label="Audio Ally home">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MascotCharacter mood="default" size={44} decorative />
            <span>Audio Ally</span>
          </span>
        </Link>
        <nav className="aa-nav-links" aria-label="Main">
          <Link to="/learn" className="aa-nav-link">
            Learn
          </Link>
          <Link to="/progress" className="aa-nav-link">
            Progress
          </Link>
          <Link to="/voices" className="aa-nav-link">
            Voices
          </Link>
          <button
            type="button"
            className="aa-btn aa-btn-tertiary"
            style={{ minHeight: 44 }}
            onClick={() => {}}
            aria-label="Account (coming soon)"
          >
            Account
          </button>
        </nav>
      </div>
    </header>
  )
}
