import React, { useState, useMemo } from 'react';
import { Search, Info, TrendingUp, AlertTriangle, ShieldCheck, ChevronRight, User } from 'lucide-react';
import candidatesData from '../data/candidates.json';
import CandidateProfile from './CandidateProfile';
import { partyColors, partyColor } from '../data/mockData';
import { getAssetPath } from '../utils/assetHelper';

const CandidateView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const candidates = useMemo(() => {
    return (Array.isArray(candidatesData) ? candidatesData : candidatesData.leaders || [])
      .map(c => ({
        ...c,
        // Map "Janasena Party" to "JSP" for consistent styling
        partyDisplay: c.party === "Janasena Party" ? "JSP" : c.party,
        // Check for criminal cases
        hasCriminalCases: parseInt(c.criminal_cases) > 0
      }));
  }, []);

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.constituency.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.ministries || []).some(m => (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenProfile = (candidate) => {
    // Adapter to match CandidateProfile expectation
    const profileAdapter = {
      ...candidate,
      party: candidate.partyDisplay,
      role: "Assembly Candidate",
      experience: "Candidate Data Verified",
      locations: [{ year: "2024", place: candidate.constituency }],
      criminalRecord: candidate.hasCriminalCases ? `${candidate.criminal_cases} Cases Reported in Affidavit` : "No Criminal Cases Reported",
      image: candidate.image ? getAssetPath(candidate.image) : `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=${partyColors[candidate.partyDisplay]?.replace('#', '') || 'cccccc'}&color=fff&size=200`,
      social_media: candidate.social_media
    };
    setSelectedCandidate(profileAdapter);
  };

  return (
    <div className="p-8 h-full flex flex-col bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto w-full">
        <header className="mb-10">
          <div className="flex items-center gap-3 text-primary mb-2">
            <ShieldCheck size={20} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Affidavit Oversight 2024</span>
          </div>
          <h1 className="text-5xl font-headline text-on-surface mb-4">Constituency Ledger</h1>
          <p className="text-on-surface-variant max-w-2xl text-lg leading-relaxed font-light">
            Verified candidate records for Andhra Pradesh general elections. Data transparency driven by official ECI filings.
          </p>
        </header>

        <div className="search-container mb-12">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            placeholder="Search candidate name, constituency, or party..." 
            className="search-input shadow-sm focus:shadow-xl focus:shadow-primary/5"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="leader-grid custom-scrollbar overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          {filteredCandidates.map(candidate => (
            <div 
              key={candidate.id} 
              className={`leader-card card-${candidate.partyDisplay.toLowerCase()}`}
              onClick={() => handleOpenProfile(candidate)}
            >
              {candidate.hasCriminalCases && (
                <div className="criminal-badge flex items-center gap-1">
                  <AlertTriangle size={10} />
                  {candidate.criminal_cases} CASES
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="party-badge party-badge--sm"
                      style={{ backgroundColor: partyColor(candidate.partyDisplay), color: '#ffffff' }}
                    >
                      {candidate.partyDisplay}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Verified</span>
                  </div>
                  <h3 className="text-xl font-headline group-hover:text-primary transition-colors pr-8">
                    {candidate.name}
                  </h3>
                </div>
                <div style={{ width: '3rem', height: '3rem', flexShrink: 0, borderRadius: '1rem', backgroundColor: 'var(--surface-container-high)', overflow: 'hidden', border: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--outline)' }}>
                    {candidate.image ? (
                      <img 
                        src={getAssetPath(candidate.image)} 
                        alt={candidate.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=random&color=fff`;
                        }}
                      />
                    ) : (
                     <User size={24} />
                   )}
                </div>
              </div>

              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                  <Info size={14} className="opacity-40" />
                  <span className="font-medium">{candidate.constituency}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/20 mt-4">
                   <div>
                      <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-0.5">Education</p>
                      <p className="text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{candidate.education || 'N/A'}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-0.5">Age</p>
                      <p className="text-xs font-semibold">{candidate.age || candidate.dob || 'N/A'}</p>
                   </div>
                   <div className="col-span-2">
                      <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-0.5">Profession</p>
                      <p className="text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{candidate.profession || 'N/A'}</p>
                   </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between group">
                <div className="flex -space-x-2">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-primary/10" />
                     </div>
                   ))}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                  Full Dossier <ChevronRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedCandidate && (
        <CandidateProfile 
          candidate={selectedCandidate} 
          onClose={() => setSelectedCandidate(null)} 
        />
      )}
    </div>
  );
};

export default CandidateView;
