import { useMemo, useState } from 'react';
import type { CoursePlant } from './course';
import type { CourseData } from './types';
import { createScavengerPdf } from './scavengerPdf';

interface Props { items: CoursePlant[]; data: CourseData; collectionId: string }

export function Scavenger({ items, data, collectionId }: Props) {
  const [moduleId, setModuleId] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const modules = data.modules.filter(module => module.collectionId === collectionId);
  const visible = useMemo(() => items.filter(item => (moduleId === 'all' || item.memberships.some(membership => membership.moduleId === moduleId)) && `${item.plant.commonName} ${item.plant.scientificName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [items, moduleId, query]);
  const chosen = items.filter(item => selected.has(item.plant.id));
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const exportPdf = async () => {
    if (!chosen.length) return;
    setWorking(true); setError('');
    try {
      const title = moduleId === 'all' ? 'My scavenger hunt' : `${modules.find(module => module.id === moduleId)?.name || 'My'} scavenger hunt`;
      const blob = await createScavengerPdf(chosen, title);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plant-walk-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the PDF.'); }
    finally { setWorking(false); }
  };

  return <div className="scavenger-page"><div className="page-heading"><div><p className="eyebrow">SCAVENGER HUNT</p><h1>Make a plant walk sheet</h1></div><span className="count-pill">{selected.size} selected · {Math.ceil(selected.size / 4)} pages</span></div>
    <p className="scavenger-intro">Pick the plants you hope to spot. The PDF puts four plants on each letter-size page with their names and up to three instructor photos each. Save it on your phone or print it.</p>
    <div className="scavenger-toolbar"><label>Week<select value={moduleId} onChange={event => setModuleId(event.target.value)}><option value="all">All weeks</option>{modules.map(module => <option value={module.id} key={module.id}>{module.name} · {module.topic}</option>)}</select></label><label>Find a plant<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Common or scientific name" /></label><div className="scavenger-tools"><button className="secondary" onClick={() => setSelected(current => new Set([...current, ...visible.map(item => item.plant.id)]))}>Select shown</button><button className="secondary" onClick={() => setSelected(new Set())}>Clear</button></div></div>
    <div className="scavenger-selection"><div className="scavenger-list">{visible.map(item => <label className="scavenger-choice" key={item.plant.id}><input type="checkbox" checked={selected.has(item.plant.id)} onChange={() => toggle(item.plant.id)} />{item.images[0] ? <img loading="lazy" src={`${import.meta.env.BASE_URL}${item.images[0].url.replace(/^\//, '')}`} alt="" /> : <span className="scavenger-no-photo">No photo</span>}<span><strong>{item.membership.facts.commonName}</strong><em>{item.membership.facts.scientificName}</em><small>{item.images.length ? `${Math.min(item.images.length, 3)} photos` : 'No instructor photos'}</small></span></label>)}{!visible.length && <p className="empty-note">No plants match your search.</p>}</div><aside className="scavenger-summary"><h2>Ready for your walk?</h2><p>{selected.size ? `${selected.size} plants across ${Math.ceil(selected.size / 4)} page${selected.size > 4 ? 's' : ''}.` : 'Choose at least one plant to make a sheet.'}</p><button className="primary" disabled={!selected.size || working} onClick={() => void exportPdf()}>{working ? 'Building PDF…' : 'Download PDF'}</button>{error && <p role="alert" className="scavenger-error">{error}</p>}<small>For a quick phone reference, choose a short list so the file stays small.</small></aside></div>
  </div>;
}
