import { useMemo, useState } from 'react';
import type { CoursePlant } from './course';
import { answerDrill, packetAt, plantsForModule, startDrill, type DrillState } from './learn';
import type { CourseData, ReviewEvent } from './types';

interface Props {
  items: CoursePlant[];
  data: CourseData;
  collectionId: string;
  onReview: (event: ReviewEvent) => void;
}

const photoUrl = (url: string) => `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;

export function LearnFive({ items, data, collectionId, onReview }: Props) {
  const modules = data.modules.filter(module => module.collectionId === collectionId);
  const [moduleId, setModuleId] = useState(modules[0]?.id || '');
  const [packetIndex, setPacketIndex] = useState(0);
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [flipped, setFlipped] = useState(false);
  const ordered = useMemo(() => plantsForModule(items, moduleId), [items, moduleId]);
  const packetCount = Math.ceil(ordered.length / 5);
  const packet = packetAt(ordered, packetIndex);
  const current = packet.find(item => item.plant.id === drill?.queue[0]);
  const mastered = packet.filter(item => (drill?.hits[item.plant.id] || 0) >= 2).length;
  const choosePacket = (index: number) => { setPacketIndex(index); setDrill(null); setFlipped(false); };
  const gradeRecall = (remembered: boolean) => {
    if (!drill?.queue.length) return;
    onReview({ at: new Date().toISOString(), collectionId, plantId: drill.queue[0], skill: current?.images.length ? 'identification' : 'scientificSpelling', rating: remembered ? 'good' : 'again' });
    setDrill(answerDrill(drill, remembered));
    setFlipped(false);
  };

  return <div className="learn-page">
    <div className="page-heading"><div><p className="eyebrow">LEARN FIVE</p><h1>Get to know five plants at a time</h1></div><span className="count-pill">{ordered.length} plants in this week</span></div>
    <div className="learn-intro">Study the five names and photos first. Then try to recall both names from an image, flip for the answer, and mark how you did. Each plant comes back until you remember it twice.</div>
    <div className="learn-controls">
      <label>Week<select value={moduleId} onChange={event => { setModuleId(event.target.value); choosePacket(0); }}>{modules.map(module => <option key={module.id} value={module.id}>{module.name} · {module.topic}</option>)}</select></label>
      <label>Packet<select value={packetIndex} onChange={event => choosePacket(Number(event.target.value))}>{Array.from({ length: packetCount }, (_, index) => <option key={index} value={index}>Plants {index * 5 + 1}–{Math.min(ordered.length, index * 5 + 5)}</option>)}</select></label>
      {drill && <button className="secondary" onClick={() => { setDrill(null); setFlipped(false); }}>Preview these five</button>}
    </div>
    {!drill && <>
      <div className="packet-grid">{packet.map((item, index) => <article className="packet-plant" key={item.plant.id}>
        <span className="packet-number">{packetIndex * 5 + index + 1}</span>
        <div className="packet-photos">{item.images.slice(0, 3).map(image => <img key={image.id} src={photoUrl(image.url)} alt={`Instructor view of ${item.membership.facts.commonName}`} />)}{!item.images.length && <span>No instructor image</span>}</div>
        <div className="packet-info"><h2>{item.membership.facts.commonName}</h2><p><em>{item.membership.facts.scientificName}</em></p><small>{item.membership.facts.height && `Height ${item.membership.facts.height} · `}{item.membership.facts.spread && `Spread ${item.membership.facts.spread} · `}WUCOLS {item.membership.facts.wucolsZone3}</small></div>
      </article>)}</div>
      <div className="learn-actions"><button className="primary" disabled={!packet.length} onClick={() => setDrill(startDrill(packet.map(item => item.plant.id)))}>Start flip drill</button></div>
    </>}
    {drill?.queue.length === 0 && <div className="start-card learn-complete"><div className="start-mark">✳</div><h2>All five recalled twice</h2><p>Come back later to strengthen them, or move on to the next packet. The regular Study mode will also bring them back for spaced review.</p><div className="learn-actions"><button className="secondary" onClick={() => setDrill(null)}>Preview again</button><button className="primary" disabled={packetIndex + 1 >= packetCount} onClick={() => choosePacket(packetIndex + 1)}>Next five plants</button></div></div>}
    {drill && current && <div className="learn-drill">
      <div className="learn-progress"><strong>{mastered} of {packet.length} recalled twice</strong><div>{packet.map(item => <span key={item.plant.id} className={(drill.hits[item.plant.id] || 0) >= 2 ? 'done' : (drill.hits[item.plant.id] || 0) === 1 ? 'once' : ''} title={`${item.membership.facts.commonName}: ${drill.hits[item.plant.id] || 0} recalls`} />)}</div></div>
      <div className="flip-card" key={`${current.plant.id}-${drill.attempts[current.plant.id]}`}>
        {!flipped ? <div className="flip-face"><p className="eyebrow">{current.images.length ? 'LOOK AT THE PHOTO' : 'COMMON NAME CUE'}</p><div className="flip-photo">{current.images.length ? <img src={photoUrl(current.images[drill.attempts[current.plant.id] % current.images.length].url)} alt="Unlabeled instructor plant" /> : <div className="image-empty">{current.membership.facts.commonName}</div>}</div><p>{current.images.length ? 'Say the common and scientific names to yourself, then reveal them.' : 'Recall the scientific name, then reveal it.'}</p></div>
          : <div className="flip-face flip-answer"><p className="eyebrow">THE ANSWER</p><h2>{current.membership.facts.commonName}</h2><p className="flip-scientific"><em>{current.membership.facts.scientificName}</em></p><div className="flip-facts"><span>Height <strong>{current.membership.facts.height || '—'}</strong></span><span>Spread <strong>{current.membership.facts.spread || '—'}</strong></span><span>WUCOLS <strong>{current.membership.facts.wucolsZone3}</strong></span></div>{current.membership.facts.distinguishingFeatures.length > 0 && <p className="flip-feature">{current.membership.facts.distinguishingFeatures.join('; ')}</p>}<div className="flip-answer-photos">{current.images.slice(0, 3).map(image => <img key={image.id} src={photoUrl(image.url)} alt="" />)}</div></div>}
      </div>
      <div className="learn-actions">{!flipped ? <button className="primary" onClick={() => setFlipped(true)}>Flip to see names</button> : <><button className="secondary" onClick={() => gradeRecall(false)}>Not yet · show again</button><button className="primary" onClick={() => gradeRecall(true)}>{current.images.length ? 'I recalled both names' : 'I recalled the scientific name'}</button></>}</div>
      <p className="learn-hint">{flipped ? 'Be honest with yourself. A miss puts this plant back into the packet.' : 'No typing needed. The next pass may use a different instructor photo.'}</p>
    </div>}
  </div>;
}
