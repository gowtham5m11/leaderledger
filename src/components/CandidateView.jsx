import React, { useState } from 'react';
import { mockCandidates, mockNews, partyColors } from '../data/mockData';
import { User, ArrowLeft, Calendar, MapPin, Briefcase, GraduationCap, AlertCircle, TrendingUp, ChevronRight } from 'lucide-react';

const CandidateView = () => {
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  if (selectedCandidate) {
    const partyKey = selectedCandidate.party.toLowerCase();
    const ledgerClass = `ledger-line-${partyKey}`;

    return (
      <div className="max-w-5xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          className="flex items-center gap-2 text-sm font-semibold text-primary mb-12 hover:-translate-x-1 transition-transform" 
          onClick={() => setSelectedCandidate(null)}
        >
          <ArrowLeft size={16} />
          Back to Assembly
        </button>
        
        <div className={`glass-panel rounded-[2.5rem] p-12 relative overflow-hidden ${ledgerClass}`}>
          <div className="flex flex-col md:flex-row gap-16">
            {/* Asymmetric Profile Section */}
            <div className="w-full md:w-1/3">
              <div className="profile-portrait-wrapper w-full">
                <div className="profile-portrait-decoration"></div>
                <img 
                  src={selectedCandidate.image} 
                  alt={selectedCandidate.name} 
                  className="profile-portrait-image w-full aspect-[4/5] shadow-2xl" 
                />
              </div>
              
              <div className="mt-8 space-y-4">
                <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="label-sm text-outline">Party</p>
                    <p className="font-bold text-lg">{selectedCandidate.party}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: partyColors[selectedCandidate.party] }}></div>
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="flex-1">
              <span className="text-primary font-bold text-xs tracking-widest uppercase">Member Profile</span>
              <h2 className="font-headline text-5xl mt-4 mb-2">{selectedCandidate.name}</h2>
              <p className="text-xl text-on-surface-variant font-medium mb-12">{selectedCandidate.role}</p>

              <div className="grid grid-cols-2 gap-y-10 gap-x-12 mb-16">
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <Calendar size={18} />
                    <span className="label-sm font-bold">Born</span>
                  </div>
                  <p className="font-medium">{selectedCandidate.dob} ({selectedCandidate.age} Yrs)</p>
                  <p className="text-sm text-outline mt-1">{selectedCandidate.birthplace}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <Briefcase size={18} />
                    <span className="label-sm font-bold">Experience</span>
                  </div>
                  <p className="font-medium">{selectedCandidate.experience}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <GraduationCap size={18} />
                    <span className="label-sm font-bold">Education</span>
                  </div>
                  <p className="font-medium">{selectedCandidate.education}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <TrendingUp size={18} />
                    <span className="label-sm font-bold">Status</span>
                  </div>
                  <p className="font-medium">{selectedCandidate.ministry}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="mb-12">
                <h4 className="font-headline text-2xl mb-6">Legislative Journey</h4>
                <div className="space-y-4">
                  {selectedCandidate.locations.map((loc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                      <div className="flex items-center gap-4">
                        <MapPin size={18} className="text-primary" />
                        <span className="font-medium">{loc.place}</span>
                      </div>
                      <span className="font-bold text-primary">{loc.year}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Criminal Record Notice */}
              <div className="p-6 bg-[#fdeded] rounded-2xl border-l-4 border-jsp flex gap-4">
                <AlertCircle className="text-jsp flex-shrink-0" size={24} />
                <div>
                  <h5 className="font-bold text-[#b91c1c] text-sm uppercase tracking-wide">Legal Disclosure</h5>
                  <p className="text-[#b91c1c] text-sm mt-1 leading-relaxed">{selectedCandidate.criminalRecord}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className="text-primary font-bold text-xs tracking-widest uppercase">Legislators</span>
          <h2 className="font-headline text-5xl mt-4">Assembly Candidates</h2>
          <p className="text-on-surface-variant mt-4 max-w-xl">
            Explore the representatives of Andhra Pradesh. Access verified demographic data, 
            legislative history, and public records for each member.
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-surface-container rounded-full px-6 py-3 flex items-center gap-4 border border-outline-variant">
            <span className="text-sm font-bold">Filter By Party</span>
            <div className="flex gap-2">
              <div className="w-4 h-4 rounded-full bg-tdp cursor-pointer"></div>
              <div className="w-4 h-4 rounded-full bg-ysrcp cursor-pointer"></div>
              <div className="w-4 h-4 rounded-full bg-jsp cursor-pointer"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockCandidates.map((cand) => {
           const partyKey = cand.party.toLowerCase();
           return (
            <div 
              key={cand.id} 
              className={`candidate-card p-6 flex items-center gap-6 ledger-line-${partyKey}`}
              onClick={() => setSelectedCandidate(cand)}
            >
              <img 
                src={cand.image} 
                alt={cand.name} 
                className="w-24 h-24 rounded-2xl object-cover shadow-lg"
              />
              <div className="flex-1">
                <p className="label-sm text-primary font-bold">{cand.party}</p>
                <h3 className="font-headline text-2xl mt-1">{cand.name}</h3>
                <div className="flex items-center gap-4 mt-3 text-sm text-outline font-medium">
                  <span className="flex items-center gap-1"><MapPin size={14} /> {cand.role}</span>
                  <span className="w-1 h-1 rounded-full bg-outline opacity-30"></span>
                  <span>{cand.ministry}</span>
                </div>
              </div>
              <ChevronRight className="text-outline-variant" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CandidateView;
