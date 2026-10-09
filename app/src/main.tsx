import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CourseData, Progress, Rating, ReviewEvent, Skill } from './types';
import { collectionPlants, filterByModules, moduleNames, type CoursePlant } from './course';
import { gradeApproxDimension, gradeCommonName, gradeScientificName, gradeWucols, spellingDiff } from './grading';
import { dueScore, loadProgress, recordReview, reviewKey, saveProgress } from './progress';
import { loadNotes, saveNotes, type PersonalNote, type PersonalNotes } from './notes';
import { createBackup, parseBackup } from './backup';
import { LearnFive } from './LearnFive';
import { Scavenger } from './Scavenger';
import './style.css';

type View = 'learn' | 'study' | 'library' | 'scavenger' | 'final' | 'progress';
type PracticeMode = 'mixed' | 'rich' | 'weak' | Skill;
type IdentifyAsk = 'common' | 'scientific' | 'both';
const LABELS: Record<Skill, string> = {
  identification: 'Plant identification', scientificSpelling: 'Scientific spelling', commonName: 'Common name',
  height: 'Mature height', spread: 'Mature spread', wucolsZone3: 'WUCOLS Zone 3',
  distinguishingFeatures: 'Distinguishing features', importantFacts: 'Important information',
};
const SKILLS: Skill[] = ['identification', 'scientificSpelling', 'commonName', 'height', 'spread', 'wucolsZone3', 'distinguishingFeatures', 'importantFacts'];
const RATINGS: { value: Rating; label: string }[] = [
  { value: 'again', label: 'Again' }, { value: 'hard', label: 'Hard' }, { value: 'good', label: 'Good' }, { value: 'easy', label: 'Easy' },
];
const EXAM_LABELS: Record<string, string> = { scientificName: 'Scientific spelling', commonName: 'Common name', height: 'Height', spread: 'Spread', wucolsZone3: 'WUCOLS' };

function BotanicalName({ name }: { name: string }) {
  const cultivarAt = name.indexOf("'");
  return <span className="botanical-name">{cultivarAt > 0 ? <><em>{name.slice(0, cultivarAt).trimEnd()}</em> {name.slice(cultivarAt)}</> : <em>{name}</em>}</span>;
}

function useCourse() {
  const [data, setData] = useState<CourseData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}course.json`).then(r => { if (!r.ok) throw new Error('Course data could not be loaded'); return r.json(); })
      .then(setData).catch(e => setError(String(e)));
  }, []);
  return { data, error };
}

function useProgress() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    try { saveProgress(progress); setSaveError(''); } catch { setSaveError('Study progress could not be saved. Export a backup now.'); }
  }, [progress]);
  return { progress, setProgress, saveError };
}

function availableSkills(item: CoursePlant): Skill[] {
  const f = item.membership.facts;
  return SKILLS.filter(s => s === 'identification' ? item.images.length > 0 :
    s === 'scientificSpelling' ? !!f.scientificName :
    s === 'commonName' ? !!f.commonName :
    s === 'height' ? !!f.height : s === 'spread' ? !!f.spread :
    s === 'wucolsZone3' ? !!f.wucolsZone3 :
    s === 'distinguishingFeatures' ? f.distinguishingFeatures.length > 0 : f.importantFacts.length > 0);
}

function sourceLabel(ref: { file: string; page?: number; row?: number }) {
  return `${ref.file}${ref.row ? ` · row ${ref.row}` : ''}${ref.page ? ` · p. ${ref.page}` : ''}`;
}

function ImageGallery({ item, index, onChange, className = '', hideIdentity = false }: { item: CoursePlant; index: number; onChange: (n: number) => void; className?: string; hideIdentity?: boolean }) {
  const image = item.images[index % item.images.length];
  return <div className={`image-gallery ${className}`}>
    {image ? <img src={`${import.meta.env.BASE_URL}${image.url.slice(1)}`} alt={`Instructor image ${index + 1} of ${item.images.length}${hideIdentity ? '' : ` for ${item.plant.scientificName}`}`} /> : <div className="image-empty">No instructor photo is associated with this plant.</div>}
    {item.images.length > 1 && <div className="image-controls">
      <button type="button" onClick={() => onChange((index - 1 + item.images.length) % item.images.length)} aria-label="Previous image">‹</button>
      <span>{(index % item.images.length) + 1} / {item.images.length}</span>
      <button type="button" onClick={() => onChange((index + 1) % item.images.length)} aria-label="Next image">›</button>
    </div>}
    {image && <div className="image-source">{image.part || 'Instructor photo'} · {sourceLabel(image.sourceRef)}</div>}
  </div>;
}

function Field({ label, value, revealed, onReveal }: { label: string; value: string | null | undefined; revealed: boolean; onReveal: () => void }) {
  return <div className="fact-row"><span>{label}</span>{revealed ? <strong>{value || 'Not supplied in course materials'}</strong> : <button type="button" className="text-button" onClick={onReveal}>Reveal</button>}</div>;
}

function FactList({ item, revealed, onReveal }: { item: CoursePlant; revealed: Set<string>; onReveal: (key: string) => void }) {
  const f = item.membership.facts;
  const fields: [string, string, string | null][] = [
    ['commonName', 'Common name', f.commonName], ['scientificName', 'Scientific name', f.scientificName],
    ['height', 'Mature height', f.height], ['spread', 'Mature spread', f.spread],
    ['wucolsZone3', 'WUCOLS Zone 3', f.wucolsZone3], ['origin', 'Origin', f.origin],
    ['distinguishingFeatures', item.hasPersonalFeatures ? 'Distinguishing features · your notes' : 'Distinguishing features', f.distinguishingFeatures.join('; ')],
    ['importantFacts', item.hasPersonalFacts ? 'Important information · your notes' : 'Important information', f.importantFacts.join('; ')],
  ];
  return <div className="fact-list">{fields.map(([key, label, value]) => <Field key={key} label={label} value={value} revealed={revealed.has(key)} onReveal={() => onReveal(key)} />)}</div>;
}

function choosePrompt(items: CoursePlant[], mode: PracticeMode, progress: Progress, excluded: Set<string>, collectionId: string): { item: CoursePlant; skill: Skill } | null {
  const candidates = items.flatMap(item => availableSkills(item).filter(skill => mode === 'mixed' || mode === skill || (mode === 'rich' && skill === 'identification') || (mode === 'weak' && !!progress.reviews[reviewKey(collectionId, item.plant.id, skill)]?.incorrect)).map(skill => ({ item, skill })));
  const remaining = candidates.filter(({ item, skill }) => !excluded.has(`${item.plant.id}:${skill}`));
  const pool = remaining.length ? remaining : candidates;
  pool.sort((a, b) => dueScore(progress.reviews[reviewKey(collectionId, b.item.plant.id, b.skill)]) - dueScore(progress.reviews[reviewKey(collectionId, a.item.plant.id, a.skill)]));
  return pool.length ? pool[Math.floor(Math.random() * Math.min(5, pool.length))] : null;
}

function Study({ items, data, collectionId, progress, onReview, selectedModules, setSelectedModules }: {
  items: CoursePlant[]; data: CourseData; collectionId: string; progress: Progress; onReview: (event: ReviewEvent) => void;
  selectedModules: string[]; setSelectedModules: (v: string[]) => void;
}) {
  const [mode, setMode] = useState<PracticeMode>('mixed');
  const [identifyAsk, setIdentifyAsk] = useState<IdentifyAsk>('both');
  const [spellingCue, setSpellingCue] = useState<'photo' | 'common'>('photo');
  const [prompt, setPrompt] = useState<{ item: CoursePlant; skill: Skill } | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [imageIndex, setImageIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [answer, setAnswer] = useState('');
  const [secondAnswer, setSecondAnswer] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const scoped = useMemo(() => filterByModules(items, selectedModules), [items, selectedModules]);
  const moduleList = data.modules.filter(m => m.collectionId === collectionId);
  const weakCount = scoped.reduce((count, item) => count + availableSkills(item).filter(skill => !!progress.reviews[reviewKey(collectionId, item.plant.id, skill)]?.incorrect).length, 0);
  const next = (newSeen = seen) => {
    const picked = choosePrompt(scoped, mode, progress, newSeen, collectionId);
    setPrompt(picked); setRevealed(new Set()); setAnswer(''); setSecondAnswer(''); setChecked(null);
    if (picked) setImageIndex((progress.reviews[reviewKey(collectionId, picked.item.plant.id, picked.skill)]?.attempts || 0) % Math.max(1, picked.item.images.length));
  };
  useEffect(() => { setPrompt(null); setSeen(new Set()); setSessionCount(0); }, [mode, selectedModules]);
  const item = prompt?.item, skill = prompt?.skill;
  const facts = item?.membership.facts;
  const responseType = mode === 'rich' ? 'rich' : skill === 'scientificSpelling' || skill === 'commonName' || skill === 'wucolsZone3' || skill === 'identification' ? 'typed' : 'self';
  const showAnswer = () => {
    if (!item || !skill || !facts) return;
    if (mode === 'rich') {
      setRevealed(new Set(['commonName', 'scientificName', 'height', 'spread', 'wucolsZone3', 'origin', 'distinguishingFeatures', 'importantFacts']));
      return;
    }
    let correct: boolean | null = null;
    if (skill === 'scientificSpelling') correct = gradeScientificName(answer, facts.scientificName);
    if (skill === 'commonName') correct = gradeCommonName(answer, facts.commonName);
    if (skill === 'wucolsZone3') correct = gradeWucols(answer, facts.wucolsZone3);
    if (skill === 'identification') {
      const common = identifyAsk !== 'scientific' ? gradeCommonName(answer, facts.commonName) : true;
      const scientific = identifyAsk === 'scientific' ? gradeScientificName(answer, facts.scientificName) : identifyAsk === 'both' ? gradeScientificName(secondAnswer, facts.scientificName) : true;
      correct = common && scientific;
    }
    setChecked(correct);
    setRevealed(new Set(['commonName', 'scientificName', 'height', 'spread', 'wucolsZone3', 'origin', 'distinguishingFeatures', 'importantFacts']));
  };
  const rate = (rating: Rating) => {
    if (!item || !skill) return;
    const at = new Date().toISOString();
    onReview({ at, collectionId: collectionId, plantId: item.plant.id, skill, rating });
    if (skill === 'identification' && checked !== null) {
      if (identifyAsk !== 'scientific') onReview({ at, collectionId: collectionId, plantId: item.plant.id, skill: 'commonName', rating: gradeCommonName(answer, facts!.commonName) ? rating : 'again' });
      if (identifyAsk !== 'common') onReview({ at, collectionId: collectionId, plantId: item.plant.id, skill: 'scientificSpelling', rating: gradeScientificName(identifyAsk === 'scientific' ? answer : secondAnswer, facts!.scientificName) ? rating : 'again' });
    }
    const nextSeen = new Set(seen).add(`${item.plant.id}:${skill}`);
    setSeen(nextSeen); setSessionCount(n => n + 1);
    setTimeout(() => next(nextSeen), 0);
  };
  const promptText = mode === 'rich' ? 'Study this plant' : skill === 'identification' ? 'Identify this plant from an instructor image' : skill === 'scientificSpelling' ? 'Type the scientific name' : skill === 'commonName' ? 'Recall the common name' : skill === 'wucolsZone3' ? 'What is its Zone 3 plant factor?' : skill === 'height' ? 'What is its approximate mature height?' : skill === 'spread' ? 'What is its approximate mature spread?' : skill === 'distinguishingFeatures' ? 'What physical features distinguish it?' : 'What else is important about this plant?';
  return <div className="study-layout">
    <div className="study-main">
      <div className="page-heading"><div><p className="eyebrow">STUDY</p><h1>What should I study next?</h1></div><span className="count-pill">{sessionCount} reviewed this session</span></div>
      <div className="study-options">
        <label>Practice <select value={mode} onChange={e => setMode(e.target.value as PracticeMode)}><option value="mixed">Recommended mix</option><option value="weak">Weak areas</option><option value="rich">Rich study card</option>{SKILLS.map(s => <option key={s} value={s}>{LABELS[s]}</option>)}</select></label>
        <div className="module-picker"><span>Modules</span><div className="chips"><button className={!selectedModules.length ? 'active' : ''} onClick={() => setSelectedModules([])}>All</button>{moduleList.map(m => <button key={m.id} className={selectedModules.includes(m.id) ? 'active' : ''} onClick={() => setSelectedModules(selectedModules.includes(m.id) ? selectedModules.filter(x => x !== m.id) : [...selectedModules, m.id])}>{m.name}</button>)}</div><label className="cumulative-select">Cumulative through <select value="" onChange={e => { const max = Number(e.target.value); if (max) setSelectedModules(moduleList.filter(m => m.order <= max).map(m => m.id)); }}><option value="">Choose module…</option>{moduleList.map(m => <option key={m.id} value={m.order}>{m.name}</option>)}</select></label></div>
      </div>
      {!prompt ? <div className="start-card"><div className="start-mark">✳</div><h2>{mode === 'weak' ? `${weakCount} weak facts to revisit` : `${scoped.length} plants ready to practice`}</h2><p>{mode === 'weak' && !weakCount ? 'Weak facts appear here after you miss a review.' : 'Review the facts due soonest, or choose a specific skill and week above.'}</p><button className="primary" disabled={mode === 'weak' && !weakCount} onClick={() => next()}>Start studying</button></div> : item && facts && <article className="review-card">
        <div className="card-topline"><span>{LABELS[skill!]}</span><span>{moduleNames(item, data)}</span></div>
        <h2>{promptText}</h2>
        {skill === 'identification' && mode !== 'rich' && <label className="ask-select">Answer with <select value={identifyAsk} onChange={e => setIdentifyAsk(e.target.value as IdentifyAsk)} disabled={checked !== null}><option value="both">Both names</option><option value="common">Common name</option><option value="scientific">Scientific name</option></select></label>}
        {skill === 'scientificSpelling' && <label className="ask-select">Cue <select value={spellingCue} onChange={e => setSpellingCue(e.target.value as 'photo' | 'common')} disabled={checked !== null}><option value="photo">Instructor photo</option><option value="common">Common name</option></select></label>}
        {(mode === 'rich' || skill === 'identification' || (skill === 'scientificSpelling' && spellingCue === 'photo')) ? <ImageGallery item={item} index={imageIndex} onChange={setImageIndex} className="study-photo" hideIdentity /> : <div className="name-prompt"><span>PLANT</span>{skill === 'scientificSpelling' ? <strong>{facts.commonName}</strong> : <><BotanicalName name={facts.scientificName} />{skill !== 'commonName' && <strong>{facts.commonName}</strong>}</>}</div>}
        {responseType === 'rich' && <><FactList item={item} revealed={revealed} onReveal={key => setRevealed(new Set([...revealed, key]))} /><div className="rich-actions"><button className="secondary" onClick={showAnswer}>Reveal all</button></div></>}
        {responseType === 'typed' && checked === null && <div className="answer-area">
          <label>{skill === 'identification' ? identifyAsk === 'scientific' ? 'Scientific name' : 'Common name' : LABELS[skill!]}
            <input autoComplete="off" spellCheck={false} value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) showAnswer(); }} placeholder="Type your answer" /></label>
          {skill === 'identification' && identifyAsk === 'both' && <label>Scientific name<input autoComplete="off" spellCheck={false} value={secondAnswer} onChange={e => setSecondAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && answer.trim() && secondAnswer.trim()) showAnswer(); }} placeholder="Type the scientific name" /></label>}
          <button className="primary" disabled={!answer.trim() || (skill === 'identification' && identifyAsk === 'both' && !secondAnswer.trim())} onClick={showAnswer}>Check answer</button>
        </div>}
        {responseType === 'self' && !revealed.size && <div className="self-prompt"><p>Recall your answer, then reveal the course material and rate your recall.</p><button className="primary" onClick={showAnswer}>Show answer</button></div>}
        {!!revealed.size && <>{responseType !== 'rich' && <div className={`feedback ${checked === null ? '' : checked ? 'correct' : 'incorrect'}`}>{checked === null ? 'Compare your answer with the course record.' : checked ? 'Correct' : 'Review this answer'}</div>}
          {skill === 'scientificSpelling' && checked === false && <div className="spelling-feedback"><span>Your answer</span><div>{spellingDiff(answer, facts.scientificName).map((c, i) => <span key={i} className={c.mismatch ? 'mismatch' : ''}>{c.answer}</span>)}</div><span>Correct spelling</span><strong><BotanicalName name={facts.scientificName} /></strong></div>}
          {responseType !== 'rich' && <FactList item={item} revealed={revealed} onReveal={key => setRevealed(new Set([...revealed, key]))} />}
          <div className="rating-area"><span>How well did you know this?</span><div>{RATINGS.map(r => <button key={r.value} className={r.value} onClick={() => rate(checked === false ? 'again' : r.value)} disabled={checked === false && r.value !== 'again'}>{r.label}</button>)}</div></div>
        </>}
      </article>}
    </div>
    <aside className="study-aside"><p className="eyebrow">YOUR NEXT SESSION</p><h3>Make the weak facts stick.</h3><p>Each name, image identification, size, and plant factor has its own review schedule. Misses return sooner.</p><div className="aside-stat"><strong>{Object.values(progress.reviews).filter(r => new Date(r.dueAt).getTime() <= Date.now()).length}</strong><span>facts due now</span></div><div className="aside-stat"><strong>{Object.keys(progress.reviews).length}</strong><span>facts practiced</span></div></aside>
  </div>;
}

function Library({ items, data, collectionId, progress, personalNotes, onSaveNote }: { items: CoursePlant[]; data: CourseData; collectionId: string; progress: Progress; personalNotes: PersonalNotes; onSaveNote: (plantId: string, note: PersonalNote) => void }) {
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('all');
  const [factor, setFactor] = useState('all');
  const [selected, setSelected] = useState<CoursePlant | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [draftFeature, setDraftFeature] = useState('');
  const [draftFact, setDraftFact] = useState('');
  const filtered = items.filter(item => {
    const f = item.membership.facts;
    return (module === 'all' || item.memberships.some(m => m.moduleId === module)) &&
      (factor === 'all' || item.memberships.some(m => m.facts.wucolsZone3 === factor)) &&
      `${item.plant.scientificName} ${item.plant.commonName} ${item.plant.alternateCourseNames.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && !!f;
  });
  return <div className="library-page"><div className="page-heading"><div><p className="eyebrow">PLANT LIBRARY</p><h1>Explore the course plants</h1></div><span className="count-pill">{filtered.length} of {items.length} plants</span></div>
    <div className="filters"><label className="search-field">Search names<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Scientific or common name" /></label><label>Week<select value={module} onChange={e => setModule(e.target.value)}><option value="all">All weeks</option>{data.modules.filter(m => m.collectionId === collectionId).map(m => <option value={m.id} key={m.id}>{m.name} · {m.topic}</option>)}</select></label><label>WUCOLS<select value={factor} onChange={e => setFactor(e.target.value)}><option value="all">All values</option>{['H', 'M', 'L', 'VL'].map(c => <option key={c}>{c}</option>)}</select></label></div>
    <div className="plant-grid">{filtered.map(item => <button type="button" key={item.plant.id} className="plant-tile" onClick={() => { setSelected(item); setImageIndex(0); setDraftFeature(personalNotes[item.plant.id]?.distinguishingFeatures || ''); setDraftFact(personalNotes[item.plant.id]?.importantFacts || ''); }}>
      {item.images[0] ? <img loading="lazy" src={`${import.meta.env.BASE_URL}${item.images[0].url.slice(1)}`} alt="" /> : <div className="tile-no-image">No image</div>}
      <div><span className="tile-meta">{moduleNames(item, data)} · {item.membership.facts.wucolsZone3}</span><BotanicalName name={item.plant.scientificName} /><strong>{item.plant.commonName}</strong></div>
    </button>)}</div>
    {!filtered.length && <p className="empty-note">No plants match these filters.</p>}
    {selected && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><section className="plant-modal" role="dialog" aria-modal="true" aria-label={selected.plant.scientificName}><button className="close" aria-label="Close plant details" onClick={() => setSelected(null)}>×</button><div className="modal-media"><ImageGallery item={selected} index={imageIndex} onChange={setImageIndex} /></div><div className="modal-content"><span className="eyebrow">{moduleNames(selected, data)} · {selected.membership.category}</span><h2><BotanicalName name={selected.plant.scientificName} /></h2><p className="common-title">{selected.plant.commonName}</p><div className="detail-grid"><div><span>Height</span><strong>{selected.membership.facts.height || 'Not supplied'}</strong></div><div><span>Spread</span><strong>{selected.membership.facts.spread || 'Not supplied'}</strong></div><div><span>WUCOLS Zone 3</span><strong>{selected.membership.facts.wucolsZone3}</strong></div><div><span>Origin</span><strong>{selected.membership.facts.origin || 'Not supplied'}</strong></div></div><h3>Identifying features</h3><p>{selected.hasPersonalFeatures ? `${draftFeature} (your notes)` : 'Not supplied in the course materials.'}</p><h3>Important information</h3><p>{selected.hasPersonalFacts ? `${draftFact} (your notes)` : 'Not supplied in the course materials.'}</p><div className="personal-notes"><h3>Your study notes</h3><p>Add features you observe in a specimen or learn in class. These are stored separately from instructor data and become available for self-graded practice.</p><label>Distinguishing physical features<textarea value={draftFeature} onChange={e => setDraftFeature(e.target.value)} placeholder="For example, leaf shape, texture, bark, flowers…" /></label><label>Other important information<textarea value={draftFact} onChange={e => setDraftFact(e.target.value)} placeholder="Add a course note you want to recall" /></label><button className="secondary" onClick={() => { onSaveNote(selected.plant.id, { distinguishingFeatures: draftFeature.trim(), importantFacts: draftFact.trim() }); setSelected(null); }}>Save notes</button></div><h3>Study progress</h3><div className="mastery-list">{availableSkills(selected).map(s => { const state = progress.reviews[reviewKey(collectionId, selected.plant.id, s)]; return <div key={s}><span>{LABELS[s]}</span><strong>{state ? `${state.correct}/${state.attempts} successful · ${new Date(state.dueAt).toLocaleDateString()}` : 'Not practiced'}</strong></div>; })}</div><h3>Sources</h3><p className="source-list">{sourceLabel(selected.membership.sourceRef)}<br />{sourceLabel(selected.membership.supportingSourceRef)}{selected.membership.presentationRefs?.map(ref => <React.Fragment key={`${ref.file}${ref.page}`}><br />{sourceLabel(ref)}</React.Fragment>)}</p></div></section></div>}
  </div>;
}

function ProgressPage({ items, collectionId, progress, personalNotes, onImport }: { items: CoursePlant[]; collectionId: string; progress: Progress; personalNotes: PersonalNotes; onImport: (value: Progress, notes: PersonalNotes) => void }) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  useEffect(() => {
    const blob = new Blob([createBackup(progress, personalNotes)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [progress, personalNotes]);
  const weak = items.flatMap(item => availableSkills(item).map(skill => ({ item, skill, state: progress.reviews[reviewKey(collectionId, item.plant.id, skill)] }))).filter(x => x.state?.incorrect).sort((a, b) => dueScore(b.state) - dueScore(a.state)).slice(0, 12);
  const importData = async (file: File) => {
    try {
      const restored = parseBackup(await file.text(), personalNotes);
      onImport(restored.progress, restored.personalNotes); setMessage(`Restored ${restored.progress.history.length} review events and personal notes.`);
    }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not import this file.'); }
  };
  return <div className="progress-page"><div className="page-heading"><div><p className="eyebrow">PROGRESS</p><h1>Your study history</h1></div></div><div className="summary-cards"><div><strong>{progress.history.length}</strong><span>reviews completed</span></div><div><strong>{Object.keys(progress.reviews).length}</strong><span>facts practiced</span></div><div><strong>{Object.values(progress.reviews).filter(r => new Date(r.dueAt).getTime() <= Date.now()).length}</strong><span>facts due now</span></div></div><div className="progress-grid"><section><h2>Weak areas</h2>{weak.length ? <div className="weak-list">{weak.map(({ item, skill, state }) => <div key={`${item.plant.id}${skill}`}><BotanicalName name={item.plant.scientificName} /><span>{LABELS[skill]}</span><strong>{state!.incorrect} missed</strong></div>)}</div> : <p className="empty-note">Missed facts will appear here after you start studying.</p>}</section><section className="backup-panel"><h2>Keep a backup</h2><p>Progress and personal notes are saved in this browser. Export a file to move or restore them later.</p><a className="primary backup-link" href={downloadUrl || undefined} download={`plant-brain-progress-${new Date().toISOString().slice(0, 10)}.json`}>Export backup</a><button className="secondary" onClick={() => uploadRef.current?.click()}>Import / restore</button><input ref={uploadRef} type="file" accept="application/json,.json" hidden onChange={e => { if (e.target.files?.[0]) void importData(e.target.files[0]); e.target.value = ''; }} />{message && <p role="status">{message}</p>}</section></div></div>;
}

interface FinalAnswer { scientificName: string; commonName: string; height: string; spread: string; wucolsZone3: string; distinguishingFeatures: string; importantFacts: string }
const blankFinal = (): FinalAnswer => ({ scientificName: '', commonName: '', height: '', spread: '', wucolsZone3: '', distinguishingFeatures: '', importantFacts: '' });
type FinalResult = { item: CoursePlant; answer: FinalAnswer; grades: Record<string, boolean | null> };

function MockFinal({ items, data, collectionId, onReview }: { items: CoursePlant[]; data: CourseData; collectionId: string; onReview: (event: ReviewEvent) => void }) {
  const config = data.collections.find(c => c.id === collectionId)?.studyProfile.exam;
  const [exam, setExam] = useState<CoursePlant[]>([]);
  const [at, setAt] = useState(0);
  const [form, setForm] = useState<FinalAnswer>(blankFinal());
  const [results, setResults] = useState<FinalResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [openGrades, setOpenGrades] = useState<Record<string, boolean>>({});
  const start = () => { setExam([...items.filter(i => i.images.length)].sort(() => Math.random() - 0.5).slice(0, config?.plantCount || 15)); setAt(0); setResults([]); setForm(blankFinal()); setFinished(false); setImageIndex(0); setOpenGrades({}); };
  const markOpen = (item: CoursePlant, skill: 'distinguishingFeatures' | 'importantFacts', correct: boolean) => {
    const key = `${item.plant.id}:${skill}`;
    if (key in openGrades) return;
    setOpenGrades(current => ({ ...current, [key]: correct }));
    onReview({ at: new Date().toISOString(), collectionId: collectionId, plantId: item.plant.id, skill, rating: correct ? 'good' : 'again' });
  };
  const submit = () => {
    const item = exam[at]; if (!item) return;
    const f = item.membership.facts;
    const grades: Record<string, boolean | null> = {
      scientificName: gradeScientificName(form.scientificName, f.scientificName),
      commonName: gradeCommonName(form.commonName, f.commonName),
      height: gradeApproxDimension(form.height, f.height), spread: gradeApproxDimension(form.spread, f.spread),
      wucolsZone3: gradeWucols(form.wucolsZone3, f.wucolsZone3),
      distinguishingFeatures: f.distinguishingFeatures.length ? null : null,
      importantFacts: f.importantFacts.length ? null : null,
    };
    const atTime = new Date().toISOString();
    for (const skill of ['scientificSpelling', 'commonName', 'height', 'spread', 'wucolsZone3'] as Skill[]) {
      const field = skill === 'scientificSpelling' ? 'scientificName' : skill;
      if (grades[field] !== null) onReview({ at: atTime, collectionId: collectionId, plantId: item.plant.id, skill, rating: grades[field] ? 'good' : 'again' });
    }
    setResults([...results, { item, answer: form, grades }]);
    if (at + 1 === exam.length) setFinished(true);
    else { setAt(at + 1); setForm(blankFinal()); setImageIndex(0); }
  };
  if (!exam.length) return <div className="final-page"><div className="page-heading"><div><p className="eyebrow">{data.collections.find(c => c.id === collectionId)?.name.toUpperCase()}</p><h1>Mock final</h1></div></div><div className="start-card"><h2>{config?.plantCount || 15} plants, one at a time</h2><p>Identify each plant from instructor images and recall its course facts. Answers stay hidden until the end. Objective fields are checked automatically; open answers can be self-graded against any notes you have added.</p><button className="primary" onClick={start}>Begin mock final</button></div></div>;
  if (finished) {
    const fields = ['scientificName', 'commonName', 'height', 'spread', 'wucolsZone3'];
    const missed = results.filter(r => Object.values(r.grades).some(g => g === false) || ['distinguishingFeatures', 'importantFacts'].some(skill => openGrades[`${r.item.plant.id}:${skill}`] === false));
    return <div className="final-page"><div className="page-heading"><div><p className="eyebrow">MOCK FINAL · RESULTS</p><h1>{results.length} plants completed</h1></div><button className="secondary" onClick={start}>Try another 15</button></div><div className="result-stats">{fields.map(field => { const graded = results.map(r => r.grades[field]).filter(x => x !== null); return <div key={field}><strong>{graded.filter(Boolean).length}/{graded.length}</strong><span>{EXAM_LABELS[field] || field}</span></div>; })}</div><h2>Review answers and self-grade notes</h2><p>Objective fields were graded automatically. Open each plant to compare your feature and information answers with available notes.</p><div className="result-list">{results.map(r => <details key={r.item.plant.id}><summary><BotanicalName name={r.item.plant.scientificName} /><span>{Object.entries(r.grades).filter(([, grade]) => grade === false).map(([field]) => (EXAM_LABELS[field] || field).toLowerCase()).join(', ') || 'Objective fields correct'}</span></summary><div className="result-detail"><div><strong>Scientific name</strong><span>You: {r.answer.scientificName || '—'}</span><span>Course: {r.item.membership.facts.scientificName}</span></div><div><strong>Common name</strong><span>You: {r.answer.commonName || '—'}</span><span>Course: {r.item.membership.facts.commonName}</span></div><div><strong>Height · spread · WUCOLS</strong><span>You: {r.answer.height || '—'} · {r.answer.spread || '—'} · {r.answer.wucolsZone3 || '—'}</span><span>Course: {r.item.membership.facts.height || 'not supplied'} · {r.item.membership.facts.spread || 'not supplied'} · {r.item.membership.facts.wucolsZone3}</span></div>{(['distinguishingFeatures', 'importantFacts'] as const).map(skill => { const reference = r.item.membership.facts[skill].join('; '); const key = `${r.item.plant.id}:${skill}`; const ownNote = skill === 'distinguishingFeatures' ? r.item.hasPersonalFeatures : r.item.hasPersonalFacts; return <div key={skill}><strong>{skill === 'distinguishingFeatures' ? 'Distinguishing feature' : 'Important information'}</strong><span>You: {r.answer[skill] || '—'}</span><span>{reference ? `${ownNote ? 'Your study notes' : 'Course notes'}: ${reference}` : 'No reference notes supplied'}</span>{reference && <div className="self-grade">{key in openGrades ? <span>{openGrades[key] ? 'Marked correct' : 'Marked for review'}</span> : <><button onClick={() => markOpen(r.item, skill, false)}>Needs review</button><button onClick={() => markOpen(r.item, skill, true)}>I got it</button></>}</div>}</div>; })}</div></details>)}</div><h2>Suggested review targets</h2>{missed.length ? <p>{missed.map(r => r.item.plant.scientificName).join(' · ')}</p> : <p>No scored facts missed. Self-grade any open answers above to finish the review.</p>}<p className="exam-note">Fields without a source value are excluded from automatic scoring.</p></div>;
  }
  const item = exam[at];
  return <div className="final-page"><div className="page-heading"><div><p className="eyebrow">MOCK FINAL</p><h1>Plant {at + 1} of {exam.length}</h1></div><span className="count-pill">No hints</span></div><div className="exam-layout"><ImageGallery item={item} index={imageIndex} onChange={setImageIndex} hideIdentity /><div className="exam-form"><h2>Record your answers</h2>{(['scientificName', 'commonName', 'height', 'spread', 'wucolsZone3', 'distinguishingFeatures', 'importantFacts'] as (keyof FinalAnswer)[]).map(field => <label key={field}>{field === 'scientificName' ? 'Scientific name' : field === 'commonName' ? 'Common name' : field === 'height' ? 'Approximate mature height' : field === 'spread' ? 'Approximate mature spread' : field === 'wucolsZone3' ? 'WUCOLS Zone 3' : field === 'distinguishingFeatures' ? 'Distinguishing feature' : 'Additional important information'}{field === 'distinguishingFeatures' || field === 'importantFacts' ? <textarea value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} /> : <input spellCheck={field !== 'scientificName'} autoComplete="off" value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} />}</label>)}<button className="primary" onClick={submit}>Submit and continue</button></div></div></div>;
}

function App() {
  const { data, error } = useCourse();
  const { progress, setProgress, saveError } = useProgress();
  const [view, setView] = useState<View>('learn');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const collectionId = selectedCollectionId || data?.collections[0]?.id || '';
  const [personalNotes, setPersonalNotes] = useState<PersonalNotes>(() => loadNotes());
  const [notesError, setNotesError] = useState('');
  useEffect(() => { try { saveNotes(personalNotes); setNotesError(''); } catch { setNotesError('Personal notes could not be saved. Export a backup now.'); } }, [personalNotes]);
  const items = useMemo(() => data ? collectionPlants(data, collectionId).map(item => {
    const note = personalNotes[item.plant.id];
    if (!note) return item;
    return { ...item, hasPersonalFeatures: !!note.distinguishingFeatures, hasPersonalFacts: !!note.importantFacts,
      membership: { ...item.membership, facts: { ...item.membership.facts,
        distinguishingFeatures: note.distinguishingFeatures ? [note.distinguishingFeatures] : item.membership.facts.distinguishingFeatures,
        importantFacts: note.importantFacts ? [note.importantFacts] : item.membership.facts.importantFacts,
      } },
    };
  }) : [], [data, personalNotes, collectionId]);
  const onReview = (event: ReviewEvent) => setProgress(p => recordReview(p, event));
  if (error) return <main className="load-error"><h1>Course data unavailable</h1><p>{error}</p></main>;
  if (!data) return <main className="load-error"><p>Loading course plants…</p></main>;
  return <div className="app-shell"><header className="app-header"><button className="brand" onClick={() => setView('learn')}><span className="brand-icon">✳</span><span>Plant Brain</span></button><nav aria-label="Main navigation">{([['learn', 'Learn'], ['study', 'Study'], ['library', 'Library'], ['scavenger', 'Plant walk'], ...(data.collections.find(c => c.id === collectionId)?.studyProfile.exam ? [['final', 'Mock final'] as [View, string]] : []), ['progress', 'Progress']] as [View, string][]).map(([name, label]) => <button key={name} className={view === name ? 'active' : ''} onClick={() => setView(name)}>{label}</button>)}</nav>{data.collections.length > 1 ? <label className="header-collection">Collection<select value={collectionId} onChange={e => { setSelectedCollectionId(e.target.value); setSelectedModules([]); setView('learn'); }}>{data.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <span className="header-collection">{data.collections[0].name}</span>}</header>{(saveError || notesError) && <div className="save-error" role="alert">{saveError || notesError}</div>}<main className="page-wrap">{view === 'learn' ? <LearnFive key={collectionId} items={items} data={data} collectionId={collectionId} onReview={onReview} /> : view === 'study' ? <Study items={items} data={data} collectionId={collectionId} progress={progress} onReview={onReview} selectedModules={selectedModules} setSelectedModules={setSelectedModules} /> : view === 'library' ? <Library items={items} data={data} collectionId={collectionId} progress={progress} personalNotes={personalNotes} onSaveNote={(id, note) => setPersonalNotes(current => ({ ...current, [id]: note }))} /> : view === 'scavenger' ? <Scavenger key={collectionId} items={items} data={data} collectionId={collectionId} /> : view === 'final' ? <MockFinal items={items} data={data} collectionId={collectionId} onReview={onReview} /> : <ProgressPage items={items} collectionId={collectionId} progress={progress} personalNotes={personalNotes} onImport={(value, notes) => { setProgress(value); setPersonalNotes(notes); }} />}</main></div>;
}

createRoot(document.getElementById('root')!).render(<App />);
