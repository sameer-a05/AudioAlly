import PDFLearningFlow from '../components/PDFLearningFlow'

export default function StoryPlayerPage() {
  return (
    <div className="aa-player-page aa-page-enter">
      <div className="aa-player-bg" aria-hidden />
      <div className="aa-player-content">
        <PDFLearningFlow />
      </div>
    </div>
  )
}
